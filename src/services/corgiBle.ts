import { computed, ref } from 'vue'

const DEVICE_PREFIX = 'group 6'
const DEVICE_NAME = DEVICE_PREFIX
const DEVICE_NAME_ALIASES = ['M5-CORGI-POMO', 'M5StickS3', 'M5Stick-S3', 'M5Stack'] as const
const BOUND_DEVICE_STORAGE_KEY = 'koko-corgi-ble-bound-device-v2'
const NUS_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'
const NUS_RX_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'
const NUS_TX_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'
const SCAN_TIMEOUT_MS = 12000
const DEVICE_PICK_SCAN_MS = 8000
const CONNECT_TIMEOUT_MS = 9000
const WRITE_TIMEOUT_MS = 4500
const RETRY_DELAY_MS = 450
const AUTO_RECONNECT_DELAY_MS = 1200

type LinkState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error'

export interface MiniProgramBleDevice {
  deviceId: string
  name?: string
  localName?: string
  advertisServiceUUIDs?: string[]
}

interface BleWriteTarget {
  deviceId: string
  serviceId: string
  characteristicId: string
}

const linkState = ref<LinkState>('idle')
const lastError = ref('')
const connectedDeviceName = ref('')
const discoveredDevices = ref<MiniProgramBleDevice[]>([])
const boundDevice = ref<MiniProgramBleDevice | null>(null)
const target = ref<BleWriteTarget | null>(null)
let bluetoothAdapterReady = false
let deviceFoundHandler: ((result: { devices?: MiniProgramBleDevice[] }) => void) | null = null
let connectionStateHandlerReady = false
let activeConnectionToken = 0
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let manualDisconnectRequested = false

const normalizeUuid = (value: string) => value.toUpperCase()

const normalizeDeviceName = (value?: string) => String(value || '').trim()

const getDeviceDisplayName = (device: MiniProgramBleDevice) => normalizeDeviceName(device.name || device.localName) || device.deviceId

const normalizeDevice = (device: MiniProgramBleDevice): MiniProgramBleDevice => ({
  deviceId: device.deviceId,
  name: normalizeDeviceName(device.name),
  localName: normalizeDeviceName(device.localName),
  advertisServiceUUIDs: device.advertisServiceUUIDs,
})

const readBoundDevice = () => {
  if (boundDevice.value || typeof uni === 'undefined' || typeof uni.getStorageSync !== 'function') return boundDevice.value
  const stored = uni.getStorageSync(BOUND_DEVICE_STORAGE_KEY) as unknown
  if (!stored || typeof stored !== 'object') return null
  const device = stored as Partial<MiniProgramBleDevice>
  if (typeof device.deviceId !== 'string' || !device.deviceId) return null
  boundDevice.value = normalizeDevice({
    deviceId: device.deviceId,
    name: typeof device.name === 'string' ? device.name : undefined,
    localName: typeof device.localName === 'string' ? device.localName : undefined,
    advertisServiceUUIDs: Array.isArray(device.advertisServiceUUIDs) ? device.advertisServiceUUIDs.filter((uuid): uuid is string => typeof uuid === 'string') : undefined,
  })
  return boundDevice.value
}

const writeBoundDevice = (device: MiniProgramBleDevice | null) => {
  boundDevice.value = device ? normalizeDevice(device) : null
  if (typeof uni === 'undefined') return
  if (device && typeof uni.setStorageSync === 'function') {
    uni.setStorageSync(BOUND_DEVICE_STORAGE_KEY, boundDevice.value)
  } else if (!device && typeof uni.removeStorageSync === 'function') {
    uni.removeStorageSync(BOUND_DEVICE_STORAGE_KEY)
  }
}

readBoundDevice()

const textToArrayBuffer = (value: string) => {
  const text = `${value.trim()}\n`
  const buffer = new ArrayBuffer(text.length)
  const view = new Uint8Array(buffer)
  for (let index = 0; index < text.length; index += 1) {
    view[index] = text.charCodeAt(index) & 0xff
  }
  return buffer
}

const asPromise = <T = unknown>(run: (options: Record<string, unknown>) => void, options: Record<string, unknown> = {}) =>
  new Promise<T>((resolve, reject) => {
    run({
      ...options,
      success: (result: T) => resolve(result),
      fail: (error: unknown) => reject(error),
    })
  })

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const withTimeout = async <T>(task: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const withRetry = async <T>(run: () => Promise<T>, retries: number): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt < retries) await delay(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'errMsg' in error) return String((error as { errMsg?: unknown }).errMsg)
  return String(error || 'unknown error')
}

const setError = (error: unknown) => {
  lastError.value = getErrorMessage(error)
  linkState.value = 'error'
}

const ensureUniBle = () => {
  if (typeof uni === 'undefined' || typeof uni.openBluetoothAdapter !== 'function') {
    throw new Error('当前环境不支持小程序蓝牙。')
  }
}

const getPlatform = () => {
  if (typeof uni === 'undefined' || typeof uni.getSystemInfoSync !== 'function') return ''
  try {
    const systemInfo = uni.getSystemInfoSync() as { platform?: string }
    return String(systemInfo.platform || '').toLowerCase()
  } catch {
    return ''
  }
}

const isIosPlatform = () => getPlatform() === 'ios'

const clearConnectedState = (nextState: LinkState = 'idle') => {
  target.value = null
  connectedDeviceName.value = ''
  linkState.value = nextState
}

const clearReconnectTimer = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = undefined
}

const scheduleReconnect = () => {
  if (manualDisconnectRequested || reconnectTimer || !readBoundDevice()) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    void connectBoundDevice().catch((error) => {
      lastError.value = getErrorMessage(error)
    })
  }, AUTO_RECONNECT_DELAY_MS)
}

const setupConnectionStateListener = () => {
  if (connectionStateHandlerReady || typeof uni === 'undefined' || typeof uni.onBLEConnectionStateChange !== 'function') return
  uni.onBLEConnectionStateChange((result: { deviceId?: string; connected?: boolean }) => {
    const currentDeviceId = target.value?.deviceId
    if (result.connected || !currentDeviceId || (result.deviceId && result.deviceId !== currentDeviceId)) return
    clearConnectedState('idle')
    lastError.value = '蓝牙连接已断开，请重新连接。'
    scheduleReconnect()
  })
  connectionStateHandlerReady = true
}

const openAdapter = async () => {
  ensureUniBle()
  setupConnectionStateListener()
  if (bluetoothAdapterReady) return
  await withRetry(() => withTimeout(asPromise(uni.openBluetoothAdapter), CONNECT_TIMEOUT_MS, '打开蓝牙适配器超时。'), 1)
  bluetoothAdapterReady = true
}

const stopDiscovery = () => {
  if (typeof uni !== 'undefined' && typeof uni.stopBluetoothDevicesDiscovery === 'function') {
    uni.stopBluetoothDevicesDiscovery({ fail: () => undefined })
  }
}

const resetDeviceFoundHandler = () => {
  if (deviceFoundHandler && typeof uni !== 'undefined' && typeof uni.offBluetoothDeviceFound === 'function') {
    uni.offBluetoothDeviceFound(deviceFoundHandler)
  }
  deviceFoundHandler = null
}

const closeConnection = async (deviceId?: string) => {
  if (!deviceId || typeof uni === 'undefined' || typeof uni.closeBLEConnection !== 'function') return
  await asPromise(uni.closeBLEConnection, { deviceId }).catch(() => undefined)
}

const closeAdapter = async () => {
  if (typeof uni === 'undefined' || typeof uni.closeBluetoothAdapter !== 'function') return
  await asPromise(uni.closeBluetoothAdapter).catch(() => undefined)
  bluetoothAdapterReady = false
}

const cleanupBeforeConnect = async () => {
  activeConnectionToken += 1
  clearReconnectTimer()
  const previousDeviceId = target.value?.deviceId
  resetDeviceFoundHandler()
  stopDiscovery()
  clearConnectedState('idle')
  await closeConnection(previousDeviceId)

  if (!isIosPlatform()) {
    await closeAdapter()
  }
}

const findWriteTarget = async (deviceId: string): Promise<BleWriteTarget> => {
  const servicesResult = await withRetry(
    () => withTimeout(asPromise<{ services?: Array<{ uuid: string }> }>(uni.getBLEDeviceServices, { deviceId }), CONNECT_TIMEOUT_MS, '读取蓝牙服务超时。'),
    1,
  )
  const service = servicesResult.services?.find((item) => normalizeUuid(item.uuid) === NUS_SERVICE_UUID)

  if (!service) {
    throw new Error('未找到 Nordic UART 服务。')
  }

  const characteristicsResult = await withRetry(
    () =>
      withTimeout(
        asPromise<{ characteristics?: Array<{ uuid: string; properties?: Record<string, boolean> }> }>(uni.getBLEDeviceCharacteristics, {
          deviceId,
          serviceId: service.uuid,
        }),
        CONNECT_TIMEOUT_MS,
        '读取蓝牙特征超时。',
      ),
    1,
  )
  const rx = characteristicsResult.characteristics?.find((item) => normalizeUuid(item.uuid) === NUS_RX_UUID)

  if (!rx) {
    throw new Error('未找到 UART RX 写入特征。')
  }

  const tx = characteristicsResult.characteristics?.find((item) => normalizeUuid(item.uuid) === NUS_TX_UUID)
  if (tx && typeof uni.notifyBLECharacteristicValueChange === 'function') {
    uni.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId: service.uuid,
      characteristicId: tx.uuid,
      state: true,
      fail: () => undefined,
    })
  }

  return {
    deviceId,
    serviceId: service.uuid,
    characteristicId: rx.uuid,
  }
}

const formatDeviceLabel = (device: MiniProgramBleDevice) => {
  const name = getDeviceDisplayName(device)
  return name || 'unknown'
}

const hasNusAdvertisedService = (device: MiniProgramBleDevice) =>
  Boolean(device.advertisServiceUUIDs?.some((uuid) => normalizeUuid(uuid) === NUS_SERVICE_UUID))

const matchesCorgiDevice = (device: MiniProgramBleDevice) => {
  const name = normalizeDeviceName(device.name || device.localName)
  if (name.startsWith(DEVICE_PREFIX)) return true
  if (hasNusAdvertisedService(device)) return true
  if (!name) return false
  return DEVICE_NAME_ALIASES.some((alias) => name === alias || name.includes(alias))
}

const upsertDiscoveredDevice = (device: MiniProgramBleDevice) => {
  if (!matchesCorgiDevice(device)) return
  const normalized = normalizeDevice(device)
  const index = discoveredDevices.value.findIndex((item) => item.deviceId === normalized.deviceId)
  if (index >= 0) {
    discoveredDevices.value.splice(index, 1, { ...discoveredDevices.value[index], ...normalized })
    return
  }
  discoveredDevices.value = [...discoveredDevices.value, normalized]
}

const connectDevice = async (device: MiniProgramBleDevice, connectionToken: number, shouldBind = false) => {
  linkState.value = 'connecting'
  stopDiscovery()
  await withRetry(
    () => withTimeout(asPromise(uni.createBLEConnection, { deviceId: device.deviceId, timeout: CONNECT_TIMEOUT_MS }), CONNECT_TIMEOUT_MS + 1000, '建立蓝牙连接超时。'),
    1,
  )
  if (connectionToken !== activeConnectionToken) {
    await closeConnection(device.deviceId)
    throw new Error('蓝牙连接已被新的操作取消。')
  }
  try {
    const writeTarget = await findWriteTarget(device.deviceId)
    if (connectionToken !== activeConnectionToken) {
      await closeConnection(device.deviceId)
      throw new Error('蓝牙连接已被新的操作取消。')
    }
    target.value = writeTarget
  } catch (error) {
    await closeConnection(device.deviceId)
    throw error
  }
  const normalized = normalizeDevice(device)
  if (shouldBind) writeBoundDevice(normalized)
  connectedDeviceName.value = getDeviceDisplayName(normalized)
  lastError.value = ''
  linkState.value = 'connected'
}

const scanForGroupDevices = async (timeoutMs = DEVICE_PICK_SCAN_MS) => {
  await cleanupBeforeConnect()
  const connectionToken = activeConnectionToken
  await openAdapter()
  lastError.value = ''
  linkState.value = 'scanning'
  resetDeviceFoundHandler()
  discoveredDevices.value = []

  return new Promise<MiniProgramBleDevice[]>((resolve, reject) => {
    let settled = false
    const seenDeviceLabels = new Set<string>()

    const settle = (next: () => void) => {
      if (settled) return
      settled = true
      next()
    }

    const finishWithError = (error: unknown) => {
      resetDeviceFoundHandler()
      stopDiscovery()
      settle(() => reject(error))
    }

    const timer = setTimeout(() => {
      resetDeviceFoundHandler()
      stopDiscovery()
      if (discoveredDevices.value.length) {
        settle(() => resolve([...discoveredDevices.value]))
        return
      }
      const seen = Array.from(seenDeviceLabels).slice(0, 8).join('、')
      const suffix = seen ? `本轮已扫描到：${seen}。` : '本轮没有收到任何蓝牙广播。'
      settle(() => reject(new Error(`未扫描到 ${DEVICE_PREFIX} 开头的设备。${suffix}`)))
    }, timeoutMs)

    deviceFoundHandler = (result) => {
      result.devices?.forEach((device) => {
        seenDeviceLabels.add(formatDeviceLabel(device))
        upsertDiscoveredDevice(device)
      })
      if (connectionToken !== activeConnectionToken) return
    }

    uni.onBluetoothDeviceFound(deviceFoundHandler)
    uni.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: () => undefined,
      fail: (error) => {
        clearTimeout(timer)
        finishWithError(error)
      },
    })
  })
}

const connectBoundDevice = async () => {
  const device = readBoundDevice()
  if (!device) throw new Error(`请先扫描并绑定 ${DEVICE_PREFIX} 设备。`)
  await cleanupBeforeConnect()
  const connectionToken = activeConnectionToken
  await openAdapter()
  lastError.value = ''
  manualDisconnectRequested = false
  await connectDevice(device, connectionToken, false)
}

const scanAndConnectWithRetry = () => withRetry(async () => {
  if (!readBoundDevice()) throw new Error(`请先扫描并绑定 ${DEVICE_PREFIX} 设备。`)
  await connectBoundDevice()
}, 1)

const ensureConnected = async () => {
  if (target.value && linkState.value === 'connected') return target.value
  try {
    await scanAndConnectWithRetry()
    if (!target.value) throw new Error('蓝牙连接未就绪。')
    return target.value
  } catch (error) {
    setError(error)
    throw error
  }
}

export const useCorgiBle = () => {
  const connected = computed(() => linkState.value === 'connected')

  const connect = async () => {
    try {
      manualDisconnectRequested = false
      await scanAndConnectWithRetry()
      return true
    } catch (error) {
      setError(error)
      return false
    }
  }

  const scanDevices = async () => {
    try {
      manualDisconnectRequested = false
      await scanForGroupDevices()
      lastError.value = ''
      linkState.value = 'idle'
      return discoveredDevices.value
    } catch (error) {
      setError(error)
      return []
    }
  }

  const bindDevice = async (device: MiniProgramBleDevice) => {
    writeBoundDevice(device)
    manualDisconnectRequested = false
    try {
      await connectBoundDevice()
      return true
    } catch (error) {
      setError(error)
      return false
    }
  }

  const unbindDevice = async () => {
    writeBoundDevice(null)
    await disconnect()
  }

  const sendCommand = async (command: string) => {
    const writeTarget = await ensureConnected()
    try {
      await withRetry(
        () =>
          withTimeout(
            asPromise(uni.writeBLECharacteristicValue, {
              deviceId: writeTarget.deviceId,
              serviceId: writeTarget.serviceId,
              characteristicId: writeTarget.characteristicId,
              value: textToArrayBuffer(command),
            }),
            WRITE_TIMEOUT_MS,
            '蓝牙写入超时。',
          ),
        1,
      )
    } catch (error) {
      clearConnectedState('error')
      lastError.value = getErrorMessage(error)
      throw error
    }
  }

  const disconnect = async () => {
    manualDisconnectRequested = true
    clearReconnectTimer()
    activeConnectionToken += 1
    const previousDeviceId = target.value?.deviceId
    resetDeviceFoundHandler()
    stopDiscovery()
    clearConnectedState('idle')
    await closeConnection(previousDeviceId)
  }

  return {
    deviceName: DEVICE_NAME,
    devicePrefix: DEVICE_PREFIX,
    linkState,
    connected,
    connectedDeviceName,
    discoveredDevices,
    boundDevice,
    lastError,
    connect,
    scanDevices,
    bindDevice,
    unbindDevice,
    disconnect,
    sendCommand,
  }
}
