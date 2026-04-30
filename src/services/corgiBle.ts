import { computed, ref } from 'vue'

const DEVICE_NAME = 'M5-CORGI-POMO'
const NUS_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E'
const NUS_RX_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'
const NUS_TX_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'

type LinkState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error'

interface MiniProgramBleDevice {
  deviceId: string
  name?: string
  localName?: string
}

interface BleWriteTarget {
  deviceId: string
  serviceId: string
  characteristicId: string
}

const linkState = ref<LinkState>('idle')
const lastError = ref('')
const connectedDeviceName = ref('')
const target = ref<BleWriteTarget | null>(null)
let bluetoothAdapterReady = false
let deviceFoundHandler: ((result: { devices?: MiniProgramBleDevice[] }) => void) | null = null

const normalizeUuid = (value: string) => value.toUpperCase()

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

const openAdapter = async () => {
  ensureUniBle()
  if (bluetoothAdapterReady) return
  await asPromise(uni.openBluetoothAdapter)
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

const findWriteTarget = async (deviceId: string): Promise<BleWriteTarget> => {
  const servicesResult = await asPromise<{ services?: Array<{ uuid: string }> }>(uni.getBLEDeviceServices, { deviceId })
  const service = servicesResult.services?.find((item) => normalizeUuid(item.uuid) === NUS_SERVICE_UUID)

  if (!service) {
    throw new Error('未找到 Nordic UART 服务。')
  }

  const characteristicsResult = await asPromise<{ characteristics?: Array<{ uuid: string; properties?: Record<string, boolean> }> }>(
    uni.getBLEDeviceCharacteristics,
    { deviceId, serviceId: service.uuid },
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

const matchesCorgiDevice = (device: MiniProgramBleDevice) => {
  const name = device.name || device.localName || ''
  return name === DEVICE_NAME || name.includes(DEVICE_NAME)
}

const connectDevice = async (device: MiniProgramBleDevice) => {
  linkState.value = 'connecting'
  stopDiscovery()
  await asPromise(uni.createBLEConnection, { deviceId: device.deviceId, timeout: 8000 })
  target.value = await findWriteTarget(device.deviceId)
  connectedDeviceName.value = device.name || device.localName || DEVICE_NAME
  lastError.value = ''
  linkState.value = 'connected'
}

const scanAndConnect = async () => {
  await openAdapter()
  target.value = null
  connectedDeviceName.value = ''
  lastError.value = ''
  linkState.value = 'scanning'
  resetDeviceFoundHandler()

  return new Promise<void>((resolve, reject) => {
    const finishWithError = (error: unknown) => {
      resetDeviceFoundHandler()
      stopDiscovery()
      reject(error)
    }

    const timer = setTimeout(() => {
      finishWithError(new Error(`未扫描到 ${DEVICE_NAME}。`))
    }, 12000)

    deviceFoundHandler = (result) => {
      const device = result.devices?.find(matchesCorgiDevice)
      if (!device) return

      clearTimeout(timer)
      resetDeviceFoundHandler()
      connectDevice(device)
        .then(resolve)
        .catch(reject)
    }

    uni.onBluetoothDeviceFound(deviceFoundHandler)
    uni.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => undefined,
      fail: (error) => {
        clearTimeout(timer)
        finishWithError(error)
      },
    })
  })
}

const ensureConnected = async () => {
  if (target.value && linkState.value === 'connected') return target.value
  try {
    await scanAndConnect()
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
      await scanAndConnect()
      return true
    } catch (error) {
      setError(error)
      return false
    }
  }

  const sendCommand = async (command: string) => {
    const writeTarget = await ensureConnected()
    await asPromise(uni.writeBLECharacteristicValue, {
      deviceId: writeTarget.deviceId,
      serviceId: writeTarget.serviceId,
      characteristicId: writeTarget.characteristicId,
      value: textToArrayBuffer(command),
    })
  }

  const disconnect = () => {
    resetDeviceFoundHandler()
    stopDiscovery()
    if (target.value && typeof uni !== 'undefined' && typeof uni.closeBLEConnection === 'function') {
      uni.closeBLEConnection({ deviceId: target.value.deviceId, fail: () => undefined })
    }
    target.value = null
    connectedDeviceName.value = ''
    linkState.value = bluetoothAdapterReady ? 'idle' : 'idle'
  }

  return {
    deviceName: DEVICE_NAME,
    linkState,
    connected,
    connectedDeviceName,
    lastError,
    connect,
    disconnect,
    sendCommand,
  }
}
