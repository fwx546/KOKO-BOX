import time
import M5
from M5 import *
import machine


M5.begin()
lcd = M5.Lcd


# UIFlow2 usually accepts 0xRRGGBB colors. If the colors look wrong on your
# firmware, change COLOR_MODE to "rgb565_swap".
COLOR_MODE = "rgb888"


def _swap16(value):
    return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF)


def rgb(r, g, b):
    if COLOR_MODE == "rgb565_swap":
        v = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
        return _swap16(v)
    if COLOR_MODE == "rgb565":
        return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)
    return (r << 16) | (g << 8) | b


BG = rgb(248, 249, 245)
SHADOW = rgb(215, 219, 211)
OUTLINE = rgb(8, 9, 10)
GOLD = rgb(255, 198, 48)
GOLD_DARK = rgb(238, 170, 28)
WHITE = rgb(255, 255, 252)
PINK = rgb(230, 112, 100)
BROWN = rgb(92, 52, 40)
Z_DARK = rgb(72, 88, 138)
Z_MID = rgb(102, 119, 168)
Z_LIGHT = rgb(149, 161, 198)

BLE_NAME_PREFIX = "group 6-"


def make_ble_name():
    try:
        uid = machine.unique_id()
        suffix = "".join("%02X" % b for b in uid[-2:])
        return BLE_NAME_PREFIX + suffix
    except Exception:
        return BLE_NAME_PREFIX + "0000"


BLE_NAME = make_ble_name()


SCREEN_W = 240
SCREEN_H = 135

SLEEP_W = 45
SLEEP_H = 20
AWAKE_W = 44
AWAKE_H = 32

SS = 2
SOX = 0
SOY = 0
AS = 3
AOX = 0
AOY = 0

_last_btn_down = False


_IRQ_CENTRAL_CONNECT = 1
_IRQ_CENTRAL_DISCONNECT = 2
_IRQ_GATTS_WRITE = 3

_UART_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
_UART_TX = ("6E400003-B5A3-F393-E0A9-E50E24DCCA9E", 0x0010)
_UART_RX = ("6E400002-B5A3-F393-E0A9-E50E24DCCA9E", 0x0008)


class BleUART:
    def __init__(self, name):
        self.ok = False
        self.connected = False
        self.ble = None
        self.conn = None
        self.rx_handle = None
        self.tx_handle = None
        self.rx_queue = []
        self._name = name
        self._restart_at = 0
        self._restart_pending = False
        try:
            import bluetooth
            self.bluetooth = bluetooth
            self.ble = bluetooth.BLE()
            self.ble.active(True)
            self.ble.irq(self._irq)

            uart_service = (
                bluetooth.UUID(_UART_UUID),
                (
                    (bluetooth.UUID(_UART_TX[0]), _UART_TX[1]),
                    (bluetooth.UUID(_UART_RX[0]), _UART_RX[1]),
                ),
            )
            ((self.tx_handle, self.rx_handle),) = self.ble.gatts_register_services((uart_service,))
            self._advertise(name)
            self.ok = True
        except Exception:
            self.ok = False

    def _advertise(self, name):
        name_b = name.encode()
        adv = bytearray()
        adv += bytes((2, 0x01, 0x06))
        uart_uuid = bytes(self.bluetooth.UUID(_UART_UUID))
        adv += bytes((len(uart_uuid) + 1, 0x07)) + uart_uuid
        resp = bytes((len(name_b) + 1, 0x09)) + name_b
        try:
            self.ble.gap_advertise(None)
            try:
                self.ble.gap_advertise(100000, adv, resp)
            except TypeError:
                self.ble.gap_advertise(100000, adv)
        except Exception:
            pass

    def _schedule_restart(self, delay_ms=500):
        self._restart_at = time.ticks_add(time.ticks_ms(), delay_ms)
        self._restart_pending = True

    def poll(self):
        if not self.ok or not self._restart_pending:
            return
        if time.ticks_diff(time.ticks_ms(), self._restart_at) < 0:
            return
        self._restart_pending = False
        self._advertise(self._name)

    def _irq(self, event, data):
        if event == _IRQ_CENTRAL_CONNECT:
            self.conn = data[0]
            self.connected = True
        elif event == _IRQ_CENTRAL_DISCONNECT:
            self.conn = None
            self.connected = False
            self._schedule_restart()
        elif event == _IRQ_GATTS_WRITE:
            conn, handle = data
            if handle == self.rx_handle:
                try:
                    msg = self.ble.gatts_read(self.rx_handle).decode().strip()
                    if msg:
                        self.rx_queue.append(msg)
                except Exception:
                    pass

    def send(self, msg):
        if not self.ok or not self.connected or self.conn is None:
            return
        try:
            self.ble.gatts_notify(self.conn, self.tx_handle, (msg + "\n").encode())
        except Exception:
            pass


# Simple audio detector for clap (lightweight copy of pet implementation)
MIC_CLK = 0
MIC_DATA = 34

class SimpleAudioDetector:
    def __init__(self):
        self.ok = False
        self.i2s = None
        try:
            from machine import I2S, Pin
            self.buf = bytearray(512)
            self.i2s = I2S(
                0,
                sck=Pin(MIC_CLK),
                ws=Pin(MIC_CLK),
                sd=Pin(MIC_DATA),
                mode=I2S.RX,
                bits=16,
                format=I2S.MONO,
                rate=16000,
                ibuf=2048,
            )
            self.ok = True
        except Exception:
            self.ok = False

    def _rms_zcr(self, n):
        if n <= 2:
            return 0, 0
        total = 0
        zc = 0
        last = 0
        count = n // 2
        for i in range(0, n - 1, 2):
            v = self.buf[i] | (self.buf[i + 1] << 8)
            if v & 0x8000:
                v -= 65536
            total += v * v
            if i > 0 and ((v >= 0 and last < 0) or (v < 0 and last >= 0)):
                zc += 1
            last = v
        try:
            import math
            rms = int(math.sqrt(total // max(1, count)))
        except Exception:
            rms = 0
        return rms, zc

    def poll(self):
        if not self.ok:
            return False
        try:
            n = self.i2s.readinto(self.buf)
        except Exception:
            return False
        rms, zcr = self._rms_zcr(n)
        # simple heuristic for clap: short high-energy + some zcr
        if rms > 1500 and zcr > 10:
            return True
        return False


def init_ble():
    ble = BleUART(BLE_NAME)
    if ble.ok:
        return ble
    return None


def ble_command_action(cmd):
    u = cmd.strip().upper()
    if u in ("PING", "HELLO"):
        return "ping"
    if u in ("START", "POMO START", "POMO_START", "POMODORO START", "SLEEP", "FOCUS"):
        return "sleep"
    if u.startswith("POMO:") or u.startswith("POMO "):
        return "sleep"
    if u in ("DONE", "POMO DONE", "POMO_DONE", "TIMEUP", "TIME UP", "WAKE", "ALARM", "RING"):
        return "wake"
    return "unknown"


def call_any(names, *args):
    for name in names:
        if hasattr(lcd, name):
            try:
                return getattr(lcd, name)(*args)
            except Exception:
                pass
    return None


def fill_screen(color):
    call_any(("fillScreen", "clear", "fill"), color)


def fill_rect(x, y, w, h, color):
    call_any(("fillRect", "fill_rect"), int(x), int(y), int(w), int(h), color)


def set_rotation(rotation):
    call_any(("setRotation", "rotate"), rotation)


def setup_lcd():
    global SCREEN_W, SCREEN_H, SS, SOX, SOY, AS, AOX, AOY

    set_rotation(1)
    try:
        if lcd.width() < lcd.height():
            set_rotation(3)
    except Exception:
        pass

    call_any(("setBrightness", "set_brightness", "brightness"), 80)

    try:
        SCREEN_W = lcd.width()
        SCREEN_H = lcd.height()
    except Exception:
        SCREEN_W = 240
        SCREEN_H = 135

    full_sleep_scale = SCREEN_W // (SLEEP_W + 3)
    h_scale = SCREEN_H // (SLEEP_H + 12)
    if h_scale < full_sleep_scale:
        full_sleep_scale = h_scale
    SS = full_sleep_scale // 2
    if SS < 2:
        SS = 2

    SOX = (SCREEN_W - SLEEP_W * SS) // 2
    SOY = SCREEN_H - SLEEP_H * SS - 12
    if SOY < 34:
        SOY = 34

    AS = SCREEN_H // (AWAKE_H + 8)
    w_scale = SCREEN_W // (AWAKE_W + 12)
    if w_scale < AS:
        AS = w_scale
    if AS < 2:
        AS = 2
    AS = (AS * 2) // 3

    AOX = (SCREEN_W - AWAKE_W * AS) // 2
    AOY = SCREEN_H - AWAKE_H * AS - 5
    if AOY < 20:
        AOY = 20


def btn_a_pressed():
    global _last_btn_down

    btn = None
    try:
        btn = M5.BtnA
    except Exception:
        return False

    for name in ("wasPressed", "wasClicked"):
        if hasattr(btn, name):
            try:
                if getattr(btn, name)():
                    return True
            except Exception:
                pass

    for name in ("isPressed", "isHolding"):
        if hasattr(btn, name):
            try:
                down = bool(getattr(btn, name)())
                pressed = down and not _last_btn_down
                _last_btn_down = down
                return pressed
            except Exception:
                pass

    return False


def p_sleep(x, y, color):
    fill_rect(SOX + x * SS, SOY + y * SS, SS, SS, color)


def r_sleep(y, x0, x1, color):
    fill_rect(SOX + x0 * SS, SOY + y * SS, (x1 - x0) * SS, SS, color)


def p_awake(x, y, color):
    fill_rect(AOX + x * AS, AOY + y * AS, AS, AS, color)


def r_awake(y, x0, x1, color):
    fill_rect(AOX + x0 * AS, AOY + y * AS, (x1 - x0) * AS, AS, color)


def draw_runs(fn, runs, color):
    for item in runs:
        fn(item[0], item[1], item[2], color)


def draw_sleep_background():
    fill_screen(BG)
    fill_rect(SOX + 4 * SS, SOY + 19 * SS + max(1, SS // 2), 37 * SS, max(2, SS), SHADOW)
    fill_rect(SOX + 8 * SS, SOY + 19 * SS + SS, 30 * SS, max(1, SS), SHADOW)


def draw_sleeping_corgi():
    outline_runs = (
        (0, 10, 13), (0, 18, 21),
        (1, 9, 14), (1, 17, 22),
        (2, 9, 15), (2, 16, 22),
        (3, 8, 15), (3, 16, 23),
        (4, 8, 16), (4, 15, 23),
        (5, 8, 16), (5, 15, 23),
        (6, 7, 17), (6, 14, 24),
        (7, 7, 24),
        (8, 6, 38),
        (9, 5, 40),
        (10, 5, 41),
        (11, 4, 42),
        (12, 4, 43),
        (13, 2, 44),
        (14, 0, 45),
        (15, 1, 45),
        (16, 2, 44),
        (17, 4, 43),
        (18, 7, 42),
        (19, 8, 41),
    )
    draw_runs(r_sleep, outline_runs, OUTLINE)

    gold_runs = (
        (1, 10, 13), (1, 18, 21),
        (2, 10, 14), (2, 17, 21),
        (3, 9, 14), (3, 17, 22),
        (4, 9, 15), (4, 16, 22),
        (5, 9, 15), (5, 16, 22),
        (6, 8, 16), (6, 15, 23),
        (7, 8, 23),
        (8, 7, 37),
        (9, 6, 39),
        (10, 6, 40),
        (11, 5, 41),
        (12, 5, 42),
        (13, 4, 42),
        (14, 3, 42),
        (15, 4, 42),
        (16, 5, 41),
        (17, 8, 40),
        (18, 9, 39),
    )
    draw_runs(r_sleep, gold_runs, GOLD)

    draw_runs(r_sleep, ((7, 8, 10), (8, 7, 10), (9, 6, 9), (10, 6, 8)), GOLD_DARK)

    pink_runs = (
        (3, 10, 13), (4, 10, 14), (5, 10, 14), (6, 10, 14),
        (3, 18, 21), (4, 17, 21), (5, 17, 21), (6, 17, 21),
    )
    draw_runs(r_sleep, pink_runs, PINK)

    white_runs = (
        (8, 14, 17),
        (9, 13, 17),
        (10, 12, 17),
        (11, 11, 16),
        (12, 10, 16),
        (13, 2, 18),
        (13, 10, 16),
        (13, 40, 43),
        (14, 2, 22),
        (14, 18, 43),
        (15, 3, 23),
        (15, 17, 43),
        (16, 4, 21),
        (16, 17, 24),
        (16, 31, 42),
        (17, 7, 18),
        (17, 18, 23),
        (17, 32, 41),
        (18, 10, 18),
        (18, 31, 34),
    )
    draw_runs(r_sleep, white_runs, WHITE)

    leg_runs = (
        (16, 24, 31), (17, 23, 31), (18, 23, 31),
        (16, 34, 40), (17, 34, 40), (18, 34, 40),
    )
    draw_runs(r_sleep, leg_runs, GOLD)

    p_sleep(0, 14, OUTLINE)
    p_sleep(1, 14, BROWN)
    p_sleep(1, 15, BROWN)
    p_sleep(7, 12, BROWN)
    p_sleep(8, 12, BROWN)
    p_sleep(11, 12, BROWN)
    p_sleep(12, 12, BROWN)
    p_sleep(14, 15, BROWN)
    p_sleep(15, 15, BROWN)
    p_sleep(13, 16, BROWN)
    p_sleep(12, 17, BROWN)


Z_SMALL = (
    "111",
    "001",
    "010",
    "100",
    "111",
)

Z_BIG = (
    "11111",
    "00001",
    "00010",
    "00100",
    "01000",
    "10000",
    "11111",
)


def draw_glyph(pattern, x, y, scale, color):
    for row in range(len(pattern)):
        line = pattern[row]
        for col in range(len(line)):
            if line[col] == "1":
                fill_rect(x + col * scale, y + row * scale, scale, scale, color)


def draw_zzz(frame):
    clear_h = SOY
    if clear_h < 1:
        clear_h = 1
    fill_rect(0, 0, SCREEN_W, clear_h, BG)

    rise = frame % 4
    small_scale = max(1, SS)
    mid_scale = max(1, SS + 1)
    big_scale = max(2, SS + 2)

    x0 = SOX + 8 * SS
    y0 = SOY - 12 * SS
    if y0 < 2:
        y0 = 2

    draw_glyph(Z_SMALL, x0, y0 + 19 - rise * 2, small_scale, Z_LIGHT)
    draw_glyph(Z_SMALL, x0 + 8 * SS, y0 + 10 - rise * 2, mid_scale, Z_MID)
    draw_glyph(Z_BIG, x0 + 18 * SS, y0 - rise, big_scale, Z_DARK)


def draw_awake_background():
    fill_screen(BG)
    fill_rect(AOX + 1 * AS, AOY + 31 * AS + max(1, AS // 2), 41 * AS, max(2, AS), SHADOW)
    fill_rect(AOX + 8 * AS, AOY + 32 * AS, 28 * AS, max(1, AS), SHADOW)


def draw_awake_static():
    outline_runs = (
        (0, 6, 9), (0, 19, 22),
        (1, 6, 10), (1, 18, 22),
        (2, 5, 11), (2, 17, 23),
        (3, 5, 12), (3, 16, 23),
        (4, 4, 13), (4, 15, 24),
        (5, 4, 14), (5, 15, 24),
        (6, 4, 15), (6, 14, 25),
        (7, 4, 16), (7, 13, 25),
        (8, 4, 17), (8, 12, 25),
        (9, 5, 17), (9, 12, 24),
        (10, 6, 17), (10, 12, 23),
        (11, 7, 16), (11, 13, 23),
        (12, 6, 24),
        (13, 5, 25),
        (14, 4, 26),
        (15, 4, 27),
        (16, 3, 29),
        (17, 3, 31),
        (18, 3, 34),
        (19, 4, 36),
        (20, 4, 38),
        (21, 4, 40),
        (22, 5, 41),
        (23, 5, 42),
        (24, 5, 43),
        (25, 5, 44),
        (26, 6, 44),
        (27, 6, 44),
        (28, 6, 43),
        (29, 7, 43),
        (30, 8, 42),
        (31, 4, 18), (31, 20, 42),
        (32, 3, 18), (32, 20, 41),
        (33, 4, 17), (33, 21, 40),
    )
    draw_runs(r_awake, outline_runs, OUTLINE)

    gold_runs = (
        (1, 7, 10), (1, 19, 21),
        (2, 6, 11), (2, 18, 22),
        (3, 5, 12), (3, 17, 23),
        (4, 5, 13), (4, 16, 24),
        (5, 5, 14), (5, 15, 24),
        (6, 5, 15), (6, 14, 25),
        (7, 6, 16), (7, 14, 24),
        (8, 7, 16), (8, 14, 23),
        (9, 8, 15), (9, 15, 22),
        (10, 7, 16), (10, 13, 22),
        (11, 8, 15), (11, 14, 22),
        (12, 6, 24),
        (13, 5, 25),
        (14, 4, 26),
        (15, 4, 27),
        (16, 3, 29),
        (17, 5, 31),
        (18, 5, 34),
        (19, 5, 36),
        (20, 6, 38),
        (21, 6, 40),
        (22, 6, 41),
        (23, 6, 42),
        (24, 7, 43),
        (25, 7, 42),
        (26, 7, 42),
        (27, 8, 41),
        (28, 9, 40),
        (29, 7, 17), (29, 21, 40),
        (30, 8, 17), (30, 21, 39),
    )
    draw_runs(r_awake, gold_runs, GOLD)

    pink_runs = (
        (3, 7, 10), (4, 6, 11), (5, 6, 12), (6, 6, 12), (7, 7, 12), (8, 8, 11),
        (3, 19, 21), (4, 18, 22), (5, 18, 23), (6, 18, 23), (7, 19, 23), (8, 20, 22),
    )
    draw_runs(r_awake, pink_runs, PINK)

    white_runs = (
        (5, 14, 16),
        (6, 13, 16),
        (7, 13, 16),
        (8, 13, 17),
        (9, 12, 17),
        (10, 11, 18),
        (11, 10, 19),
        (12, 8, 21),
        (13, 6, 23),
        (14, 5, 24),
        (15, 4, 24),
        (16, 5, 24),
        (17, 5, 24),
        (18, 6, 24),
        (19, 6, 25),
        (20, 7, 25),
        (21, 7, 24),
        (22, 7, 23),
        (23, 8, 22),
        (24, 8, 21),
        (25, 8, 20),
        (26, 9, 20),
        (27, 9, 19),
        (28, 8, 19),
        (29, 5, 16), (29, 22, 28), (29, 36, 41),
        (30, 5, 16), (30, 22, 29), (30, 35, 40),
        (31, 6, 15), (31, 23, 29), (31, 35, 39),
    )
    draw_runs(r_awake, white_runs, WHITE)

    chest_soft_runs = (
        (24, 12, 18),
        (25, 13, 18),
        (26, 14, 19),
        (27, 15, 19),
    )
    draw_runs(r_awake, chest_soft_runs, rgb(252, 235, 224))

    # Paw and body detail marks. Face details are drawn last elsewhere.
    p_awake(29, 20, BROWN)
    p_awake(29, 21, BROWN)
    p_awake(29, 22, BROWN)
    p_awake(28, 26, BROWN)
    p_awake(27, 27, BROWN)
    p_awake(26, 28, BROWN)
    p_awake(10, 31, BROWN)
    p_awake(12, 31, BROWN)
    p_awake(25, 31, BROWN)
    p_awake(27, 31, BROWN)
    p_awake(37, 31, BROWN)


def draw_awake_tail(frame):
    fill_rect(AOX + 37 * AS, AOY + 21 * AS, 7 * AS, 9 * AS, WHITE)

    if frame == 0:
        outline = ((22, 39, 43), (23, 40, 44), (24, 40, 44), (25, 39, 43), (26, 39, 42))
        fill = ((23, 40, 43), (24, 40, 43), (25, 40, 42))
    elif frame == 1:
        outline = ((21, 38, 42), (22, 40, 44), (23, 41, 44), (24, 40, 43), (25, 39, 42))
        fill = ((22, 40, 43), (23, 41, 43), (24, 40, 42))
    else:
        outline = ((23, 39, 43), (24, 40, 44), (25, 40, 44), (26, 39, 43), (27, 38, 41))
        fill = ((24, 40, 43), (25, 40, 43), (26, 39, 42))

    draw_runs(r_awake, outline, OUTLINE)
    draw_runs(r_awake, fill, WHITE)


def draw_awake_eyes():
    # Fixed round black pixel eyes.
    p_awake(10, 11, OUTLINE)
    p_awake(11, 11, OUTLINE)
    p_awake(10, 12, OUTLINE)
    p_awake(11, 12, OUTLINE)
    p_awake(11, 11, WHITE)

    p_awake(20, 11, OUTLINE)
    p_awake(21, 11, OUTLINE)
    p_awake(20, 12, OUTLINE)
    p_awake(21, 12, OUTLINE)
    p_awake(21, 11, WHITE)


def draw_awake_mouth_nose():
    # Draw these last so the white muzzle never hides them.
    p_awake(14, 14, BROWN)
    p_awake(15, 14, BROWN)
    p_awake(16, 14, BROWN)
    p_awake(14, 15, BROWN)
    p_awake(15, 15, BROWN)
    p_awake(16, 15, BROWN)
    p_awake(15, 16, BROWN)

    p_awake(12, 17, BROWN)
    p_awake(13, 18, BROWN)
    p_awake(14, 18, BROWN)
    p_awake(16, 18, BROWN)
    p_awake(17, 18, BROWN)
    p_awake(18, 17, BROWN)
    p_awake(14, 19, PINK)
    p_awake(15, 19, PINK)
    p_awake(16, 19, PINK)


def draw_sleep_scene(zzz_frame):
    draw_sleep_background()
    draw_sleeping_corgi()
    draw_zzz(zzz_frame)


def draw_awake_scene(tail_frame):
    draw_awake_background()
    draw_awake_tail(tail_frame)
    draw_awake_static()
    draw_awake_eyes()
    draw_awake_mouth_nose()


def draw_awake_scene_offset(tail_frame, dx=0, dy=0):
    global AOX, AOY
    old_ax = AOX
    old_ay = AOY
    try:
        AOX = old_ax + int(dx)
        AOY = old_ay + int(dy)
        draw_awake_scene(tail_frame)
    finally:
        AOX = old_ax
        AOY = old_ay


def clamp(value, low, high):
    if value < low:
        return low
    if value > high:
        return high
    return value


def draw_play_ball(x, y):
    r = max(3, AS + 1)
    call_any(("fillCircle", "fill_circle"), int(x), int(y), r, GOLD_DARK)
    call_any(("drawCircle", "circle"), int(x), int(y), r, OUTLINE)


def random_ball_start(target_x, target_y):
    seed = time.ticks_ms()
    side = seed % 4
    span_x = max(1, SCREEN_W - 36)
    span_y = max(1, SCREEN_H - 36)

    if side == 0:
        return 8, 18 + ((seed // 7) % span_y)
    if side == 1:
        return SCREEN_W - 8, 18 + ((seed // 7) % span_y)
    if side == 2:
        return 18 + ((seed // 7) % span_x), 8
    return 18 + ((seed // 7) % span_x), SCREEN_H - 8


def play_catch_ball(tail_frame):
    target_x = AOX + 23 * AS
    target_y = AOY + 17 * AS
    start_x, start_y = random_ball_start(target_x, target_y)

    catch_dx = clamp((start_x - target_x) // 5, -28, 28)
    catch_dy = clamp((start_y - target_y) // 7, -12, 10)
    steps = 18

    for i in range(steps + 1):
        t = i / float(steps)
        dog_dx = int(catch_dx * t)
        dog_dy = int(catch_dy * t)
        catch_x = target_x + dog_dx
        catch_y = target_y + dog_dy
        ball_x = int(start_x + (catch_x - start_x) * t)
        ball_y = int(start_y + (catch_y - start_y) * t)

        draw_awake_scene_offset(tail_frame, dog_dx, dog_dy)
        draw_play_ball(ball_x, ball_y)
        time.sleep_ms(28)

    draw_awake_scene_offset(tail_frame, catch_dx, catch_dy)
    draw_play_ball(target_x + catch_dx, target_y + catch_dy)
    time.sleep_ms(180)

    for i in range(8):
        t = 1.0 - (i + 1) / 8.0
        draw_awake_scene_offset(tail_frame, int(catch_dx * t), int(catch_dy * t))
        time.sleep_ms(35)


def main():
    setup_lcd()
    ble = init_ble()

    btn_was_down = False
    btn_down_since = 0
    last_click_at = 0

    sleeping = True
    zzz_frame = 0
    tail_frame = 0

    next_zzz = time.ticks_add(time.ticks_ms(), 360)
    next_tail = time.ticks_add(time.ticks_ms(), 220)

    draw_sleep_scene(zzz_frame)
    if ble:
        ble.send("READY SLEEP")

    while True:
        try:
            M5.update()
        except Exception:
            pass

        now = time.ticks_ms()
        # Double-click the front button to throw a ball for the dog to catch.
        try:
            btn = M5.BtnA
            if hasattr(btn, "isPressed"):
                down = bool(btn.isPressed())
            elif hasattr(btn, "isHolding"):
                down = bool(btn.isHolding())
            else:
                down = False
        except Exception:
            down = False

        if down and not btn_was_down:
            btn_down_since = now
        if not down and btn_was_down:
            press_ms = time.ticks_diff(now, btn_down_since)
            if btn_down_since and press_ms < 650:
                if last_click_at and time.ticks_diff(now, last_click_at) <= 420:
                    last_click_at = 0
                    sleeping = False
                    tail_frame = 0
                    next_tail = time.ticks_add(now, 220)
                    play_catch_ball(tail_frame)
                    draw_awake_scene(tail_frame)
                    if ble:
                        ble.send("OK CATCH BALL")
                else:
                    last_click_at = now
                    if sleeping:
                        sleeping = False
                        tail_frame = 0
                        next_tail = time.ticks_add(now, 220)
                        draw_awake_scene(tail_frame)
                        if ble:
                            ble.send("OK WAKE BUTTON")
            else:
                last_click_at = 0
        if last_click_at and time.ticks_diff(now, last_click_at) > 420:
            last_click_at = 0
        btn_was_down = down

        if ble:
            ble.poll()

        if ble:
            while ble.rx_queue:
                cmd = ble.rx_queue.pop(0)
                action = ble_command_action(cmd)
                if action == "ping":
                    ble.send("PONG")
                elif action == "sleep":
                    sleeping = True
                    zzz_frame = 0
                    next_zzz = time.ticks_add(now, 360)
                    draw_sleep_scene(zzz_frame)
                    ble.send("OK SLEEP")
                elif action == "wake":
                    sleeping = False
                    tail_frame = 0
                    next_tail = time.ticks_add(now, 220)
                    draw_awake_scene(tail_frame)
                    ble.send("OK WAKE")
                else:
                    ble.send("ERR UNKNOWN")

        if sleeping:
            if time.ticks_diff(now, next_zzz) >= 0:
                zzz_frame = (zzz_frame + 1) % 4
                draw_zzz(zzz_frame)
                next_zzz = time.ticks_add(now, 360)
            time.sleep_ms(35)
            continue

        if time.ticks_diff(now, next_tail) >= 0:
            tail_frame = (tail_frame + 1) % 3
            draw_awake_tail(tail_frame)
            next_tail = time.ticks_add(now, 220)

        time.sleep_ms(30)


main()
