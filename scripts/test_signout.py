"""
退出登录功能端到端自测脚本

测试流程：
1. 登录
2. 验证 Header 头像下拉菜单存在退出登录入口
3. 点击 Header 头像 → 退出登录 → 验证跳转到 /login
4. 重新登录
5. 进入 /settings 页面
6. 验证"账号操作"卡片存在
7. 点击设置页的"退出登录"按钮 → 验证跳转到 /login
"""
from playwright.sync_api import sync_playwright
import time

BASE = "http://localhost:3000"
EMAIL = "test@jobtracks.dev"
PASSWORD = "test123456"

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


def login(page, label="登录"):
    print(f"\n=== {label} ===")
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
            log_fail("登录失败，仍在 /login")
            page.screenshot(path='/tmp/signout_login_fail.png', full_page=True)
            return False


def test_header_signout(page):
    """测试 1：Header 头像下拉菜单退出登录"""
    print("\n=== 测试 1：Header 头像下拉菜单退出登录 ===")
    # 在已登录状态（applications 页面）
    page.goto(f"{BASE}/applications")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 点击头像按钮（aria-label="账号菜单"）
    avatar = page.locator('button[aria-label="账号菜单"]')
    if avatar.count() == 0:
        log_fail("未找到头像按钮")
        return False
    avatar.click()
    time.sleep(0.5)

    # 验证下拉菜单中出现"退出登录"
    menu_items = page.locator('[role="menuitem"]')
    texts = [menu_items.nth(i).text_content() or '' for i in range(menu_items.count())]
    log_info(f"下拉菜单项: {texts}")

    if any('退出登录' in t for t in texts):
        log_pass("下拉菜单含'退出登录'项")
    else:
        log_fail("下拉菜单未含'退出登录'项")
        page.screenshot(path='/tmp/header_menu.png', full_page=True)
        return False

    if any('设置' in t for t in texts):
        log_pass("下拉菜单含'设置'项")
    else:
        log_fail("下拉菜单未含'设置'项")

    # 点击退出登录
    page.locator('[role="menuitem"]:has-text("退出登录")').click()
    try:
        page.wait_for_url('**/login', timeout=10000)
        log_pass(f"退出登录成功，跳转到 {page.url}")
        return True
    except Exception:
        if '/login' in page.url:
            log_pass(f"退出登录成功，跳转到 {page.url}")
            return True
        else:
            log_fail(f"退出登录失败，仍在 {page.url}")
            page.screenshot(path='/tmp/header_signout_fail.png', full_page=True)
            return False


def test_settings_signout(page):
    """测试 2：设置页面退出登录按钮"""
    print("\n=== 测试 2：设置页面退出登录按钮 ===")
    # 重新登录
    if not login(page, "重新登录"):
        return False

    # 进入设置页
    page.goto(f"{BASE}/settings")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 验证"账号操作"卡片存在
    page_content = page.content()
    if '账号操作' in page_content:
        log_pass("设置页含'账号操作'卡片")
    else:
        log_fail("设置页未含'账号操作'卡片")
        page.screenshot(path='/tmp/settings_page.png', full_page=True)
        return False

    # 找到"退出登录"按钮（在"账号操作"卡片内）
    # 设置页有两个"退出登录"元素：一个在 Header 下拉（隐藏），一个在卡片（可见）
    # 这里用 destructive 变体的 button
    signout_btn = page.locator('button:visible:has-text("退出登录")').first
    if signout_btn.count() == 0:
        log_fail("未找到可见的退出登录按钮")
        page.screenshot(path='/tmp/settings_no_btn.png', full_page=True)
        return False
    log_pass("找到可见的退出登录按钮")

    # 点击退出登录
    signout_btn.click()
    try:
        page.wait_for_url('**/login', timeout=10000)
        log_pass(f"退出登录成功，跳转到 {page.url}")
        return True
    except Exception:
        if '/login' in page.url:
            log_pass(f"退出登录成功，跳转到 {page.url}")
            return True
        else:
            log_fail(f"退出登录失败，仍在 {page.url}")
            page.screenshot(path='/tmp/settings_signout_fail.png', full_page=True)
            return False


def test_protected_after_signout(page):
    """测试 3：退出登录后访问受保护页面应跳回 /login"""
    print("\n=== 测试 3：退出登录后访问受保护页面 ===")
    # 当前在 /login
    page.goto(f"{BASE}/applications")
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    if '/login' in page.url:
        log_pass(f"未登录访问 /applications 被重定向到 {page.url}")
        return True
    else:
        log_fail(f"未登录可访问 /applications: {page.url}")
        page.screenshot(path='/tmp/protected_fail.png', full_page=True)
        return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # 先登录
            if not login(page, "首次登录"):
                raise RuntimeError("首次登录失败")

            # 测试 1
            test_header_signout(page)

            # 测试 2
            test_settings_signout(page)

            # 测试 3
            test_protected_after_signout(page)

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
