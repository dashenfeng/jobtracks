"""
移动端 Sidebar 抽屉自测脚本

测试要点：
1. 移动端视口：固定 Sidebar 不可见
2. 移动端：Header 有汉堡按钮
3. 点击汉堡 → Sheet 抽屉打开
4. Sheet 内含 Logo + 导航项
5. 点击导航项 → 跳转 + Sheet 自动关闭
6. ESC 关闭
7. 遮罩点击关闭
8. 桌面端视口：固定 Sidebar 可见，汉堡按钮不可见
"""
from playwright.sync_api import sync_playwright
import time

BASE = "http://localhost:3000"
EMAIL = "test@jobtracks.com"
PASSWORD = "123456"

# 移动端视口（iPhone 12）
MOBILE_VIEWPORT = {'width': 390, 'height': 844}
# 桌面端视口
DESKTOP_VIEWPORT = {'width': 1280, 'height': 800}

passed = 0
failed = 0


def log_pass(msg):
    global passed
    passed += 1
    print(f"  [PASS] {msg}")


def log_fail(msg):
    global failed
    failed += 1
    print(f"  [FAIL] {msg}")


def log_info(msg):
    print(f"  [INFO] {msg}")


def login(page):
    print("\n=== 登录 ===")
    page.goto(f"{BASE}/login")
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    page.fill('#email', EMAIL)
    page.fill('#password', PASSWORD)
    time.sleep(0.3)
    page.press('#password', 'Enter')
    try:
        page.wait_for_url('**/applications', timeout=10000)
        log_pass(f"登录成功，跳转到 {page.url}")
        return True
    except Exception:
        if '/login' not in page.url:
            log_pass(f"登录成功，跳转到 {page.url}")
            return True
        else:
            log_fail("登录失败")
            return False


def test_mobile_sidebar_hidden(page):
    """测试 1：移动端固定 Sidebar 不可见"""
    print("\n=== 测试 1：移动端固定 Sidebar 不可见 ===")
    # aside 有 hidden md:flex，移动端应该不可见
    aside = page.locator('aside').first
    if aside.count() == 0:
        log_pass("移动端无固定 aside 渲染")
        return True
    # 检查是否可见
    is_visible = aside.is_visible()
    if not is_visible:
        log_pass("移动端 aside 不可见（hidden md:flex 生效）")
    else:
        log_fail("移动端 aside 仍然可见")
        page.screenshot(path='/tmp/mobile_aside_visible.png', full_page=True)


def test_hamburger_visible(page):
    """测试 2：移动端汉堡按钮可见"""
    print("\n=== 测试 2：移动端汉堡按钮可见 ===")
    btn = page.locator('button[aria-label="打开导航菜单"]')
    if btn.count() == 0:
        log_fail("未找到汉堡按钮")
        return False
    if btn.is_visible():
        log_pass("汉堡按钮可见")
        return True
    else:
        log_fail("汉堡按钮不可见")
        return False


def test_open_sheet(page):
    """测试 3：点击汉堡打开 Sheet"""
    print("\n=== 测试 3：点击汉堡打开 Sheet ===")
    page.locator('button[aria-label="打开导航菜单"]').click()
    try:
        page.wait_for_selector('[role="dialog"]', timeout=5000)
        time.sleep(0.5)
        log_pass("Sheet 已打开")
        return True
    except Exception:
        log_fail("Sheet 未打开")
        page.screenshot(path='/tmp/mobile_sheet_fail.png', full_page=True)
        return False


def test_sheet_content(page):
    """测试 4：Sheet 内含 Logo + 导航项"""
    print("\n=== 测试 4：Sheet 内容验证 ===")
    dialog = page.locator('[role="dialog"]')
    content = dialog.text_content() or ''

    if '职迹' in content:
        log_pass("Sheet 含 Logo '职迹'")
    else:
        log_fail("Sheet 未含 Logo")

    # 导航项（来自 navSections，至少有"投递管理"等）
    # 检查几个关键导航文本
    nav_texts = ['投递管理', '面试日程', '工具库', 'JSON 工具']
    for t in nav_texts:
        if t in content:
            log_pass(f"Sheet 含导航项 '{t}'")
        else:
            log_fail(f"Sheet 未含导航项 '{t}'")

    if '设置' in content:
        log_pass("Sheet 含底部 '设置' 链接")
    else:
        log_fail("Sheet 未含 '设置' 链接")


def test_navigate_and_close(page):
    """测试 5：点击导航项 → 跳转 + Sheet 关闭"""
    print("\n=== 测试 5：点击导航项后 Sheet 自动关闭 ===")
    # 当前 Sheet 打开，点击"设置"链接
    # Sheet 内的设置链接 href="/settings"
    settings_link = page.locator('[role="dialog"] a[href="/settings"]').first
    if settings_link.count() == 0:
        log_fail("Sheet 内未找到设置链接")
        return False
    settings_link.click()

    # 等待跳转
    try:
        page.wait_for_url('**/settings', timeout=10000)
        log_pass(f"跳转到 {page.url}")
    except Exception:
        if '/settings' in page.url:
            log_pass(f"跳转到 {page.url}")
        else:
            log_fail(f"未跳转到 /settings，仍在 {page.url}")

    # Sheet 应该关闭
    time.sleep(1)
    if page.locator('[role="dialog"]').count() == 0:
        log_pass("Sheet 已关闭（路由切换自动关闭）")
    else:
        log_fail("Sheet 仍然打开")
        page.screenshot(path='/tmp/mobile_sheet_not_closed.png', full_page=True)


def test_esc_close(page):
    """测试 6：ESC 关闭"""
    print("\n=== 测试 6：ESC 关闭 Sheet ===")
    # 先回到 applications
    page.goto(f"{BASE}/applications")
    page.wait_for_load_state('networkidle')
    time.sleep(0.5)

    # 打开 Sheet
    page.locator('button[aria-label="打开导航菜单"]').click()
    try:
        page.wait_for_selector('[role="dialog"]', timeout=5000)
        time.sleep(0.3)
    except Exception:
        log_fail("ESC 测试：Sheet 未打开")
        return

    # 按 ESC
    page.keyboard.press('Escape')
    time.sleep(0.5)
    if page.locator('[role="dialog"]').count() == 0:
        log_pass("ESC 关闭 Sheet 成功")
    else:
        log_fail("ESC 未关闭 Sheet")


def test_overlay_close(page):
    """测试 7：遮罩点击关闭"""
    print("\n=== 测试 7：遮罩点击关闭 ===")
    page.locator('button[aria-label="打开导航菜单"]').click()
    try:
        page.wait_for_selector('[role="dialog"]', timeout=5000)
        time.sleep(0.3)
    except Exception:
        log_fail("遮罩测试：Sheet 未打开")
        return

    # 遮罩是 overlay（fixed inset-0），点右上角空白处
    # Sheet 从左滑出占 w-64 (256px)，点右侧空白
    page.mouse.click(350, 100)  # 移动端 390 宽，256 是 Sheet，350 在遮罩区
    time.sleep(0.5)
    if page.locator('[role="dialog"]').count() == 0:
        log_pass("遮罩点击关闭 Sheet 成功")
    else:
        log_fail("遮罩点击未关闭 Sheet")
        page.screenshot(path='/tmp/mobile_overlay_close.png', full_page=True)


def test_navigate_to_applications(page):
    """测试 8：点击投递管理导航"""
    print("\n=== 测试 8：点击'投递管理'导航 ===")
    page.locator('button[aria-label="打开导航菜单"]').click()
    try:
        page.wait_for_selector('[role="dialog"]', timeout=5000)
        time.sleep(0.3)
    except Exception:
        log_fail("导航测试：Sheet 未打开")
        return

    # 点击"投递管理"链接（href=/applications）
    link = page.locator('[role="dialog"] a[href="/applications"]').first
    if link.count() == 0:
        log_fail("Sheet 内未找到投递管理链接")
        return
    link.click()
    try:
        page.wait_for_url('**/applications', timeout=10000)
        log_pass(f"跳转到 {page.url}")
    except Exception:
        if '/applications' in page.url:
            log_pass(f"跳转到 {page.url}")
        else:
            log_fail(f"未跳转到 /applications")
    time.sleep(0.5)
    if page.locator('[role="dialog"]').count() == 0:
        log_pass("Sheet 已关闭")
    else:
        log_fail("Sheet 仍然打开")


def test_desktop(context):
    """测试 9：桌面端固定 Sidebar 可见，无汉堡"""
    print("\n=== 测试 9：桌面端视口验证 ===")
    page = context.new_page()
    page.set_viewport_size(DESKTOP_VIEWPORT)
    page.goto(f"{BASE}/applications")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 桌面端 aside 可见
    aside = page.locator('aside').first
    if aside.count() > 0 and aside.is_visible():
        log_pass("桌面端固定 Sidebar 可见")
    else:
        log_fail("桌面端固定 Sidebar 不可见")
        page.screenshot(path='/tmp/desktop_aside.png', full_page=True)

    # 桌面端汉堡不可见
    hamburger = page.locator('button[aria-label="打开导航菜单"]')
    if hamburger.count() == 0 or not hamburger.is_visible():
        log_pass("桌面端汉堡按钮不可见")
    else:
        log_fail("桌面端汉堡按钮仍可见")

    page.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 移动端视口
        context = browser.new_context(viewport=MOBILE_VIEWPORT)
        page = context.new_page()

        try:
            if not login(page):
                raise RuntimeError("登录失败")

            test_mobile_sidebar_hidden(page)
            test_hamburger_visible(page)
            test_open_sheet(page)
            test_sheet_content(page)
            test_navigate_and_close(page)
            test_esc_close(page)
            test_overlay_close(page)
            test_navigate_to_applications(page)

            # 桌面端测试（新页面，宽视口）
            test_desktop(context)

        finally:
            browser.close()

    print(f"\n=== 测试汇总 ===")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    if failed == 0:
        print("全部通过 ✓")
    else:
        print("存在失败 ✗")
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    import sys
    sys.exit(main())
