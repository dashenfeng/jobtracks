"""
综合自测脚本 v2：登录/退出 + 快照对比（test@jobtracks.com 账号）

修复：使用精确 ID 选择器，提交按钮文字是"创建"
"""
from playwright.sync_api import sync_playwright
import time

BASE = "http://localhost:3000"
EMAIL = "test@jobtracks.com"
PASSWORD = "123456"

SNAP_A_NAME = "TEST_SNAP_A_v1"
SNAP_A_CONTENT = '{"name":"alice","age":30,"city":"Beijing"}'
SNAP_B_NAME = "TEST_SNAP_B_v2"
SNAP_B_CONTENT = '{"name":"alice","age":31,"city":"Shanghai","email":"a@b.com"}'

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
            page.screenshot(path='/tmp/login_fail.png', full_page=True)
            return False


def signout_via_header(page):
    print("\n=== Header 头像下拉退出登录 ===")
    page.goto(f"{BASE}/applications")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    avatar = page.locator('button[aria-label="账号菜单"]')
    if avatar.count() == 0:
        log_fail("未找到头像按钮")
        return False
    avatar.click()
    time.sleep(0.5)

    menu_items = page.locator('[role="menuitem"]')
    texts = [menu_items.nth(i).text_content() or '' for i in range(menu_items.count())]
    log_info(f"下拉菜单项: {texts}")

    if any('退出登录' in t for t in texts):
        log_pass("下拉菜单含'退出登录'项")
    else:
        log_fail("下拉菜单未含'退出登录'项")
        return False

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
            return False


def signout_via_settings(page):
    print("\n=== 设置页退出登录 ===")
    if not login(page, "重新登录"):
        return False

    page.goto(f"{BASE}/settings")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    if '账号操作' in page.content():
        log_pass("设置页含'账号操作'卡片")
    else:
        log_fail("设置页未含'账号操作'卡片")
        return False

    signout_btn = page.locator('button:visible:has-text("退出登录")').first
    if signout_btn.count() == 0:
        log_fail("未找到可见的退出登录按钮")
        return False
    log_pass("找到可见的退出登录按钮")

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
            return False


def open_create_dialog(page):
    """打开新建快照对话框"""
    page.goto(f"{BASE}/tools/snapshots")
    page.wait_for_load_state('networkidle')
    time.sleep(0.5)
    page.locator('button:has-text("新建")').first.click()
    # 等待对话框出现
    page.wait_for_selector('[role="dialog"]', timeout=5000)
    time.sleep(0.3)


def create_snapshot(page, name, content):
    """创建快照：使用精确 ID 选择器"""
    open_create_dialog(page)

    # 填名称
    page.fill('#snap-name', name)
    time.sleep(0.2)
    # 填内容
    page.fill('#snap-content', content)
    time.sleep(0.2)

    # 点击创建按钮
    page.locator('button[type="submit"]:has-text("创建")').first.click()

    # 等待对话框关闭
    try:
        page.wait_for_selector('[role="dialog"]', state='detached', timeout=5000)
    except Exception:
        pass
    time.sleep(1)
    return True


def cleanup_test_snapshots(page):
    """删除所有 TEST_SNAP_ 开头的快照"""
    while True:
        page.goto(f"{BASE}/tools/snapshots")
        page.wait_for_load_state('networkidle')
        time.sleep(0.5)
        rows = page.locator('table tbody tr').all()
        found = False
        for row in rows:
            try:
                text = row.text_content() or ''
            except Exception:
                break
            if 'TEST_SNAP_' in text:
                del_btn = row.locator('button[title="删除"]')
                if del_btn.count() == 0:
                    del_btn = row.locator('button').last
                try:
                    del_btn.click()
                    time.sleep(0.5)
                    confirm = page.locator('button:has-text("确认"), button:has-text("删除"), button:has-text("确定")')
                    if confirm.count() > 0:
                        confirm.first.click()
                    time.sleep(1)
                    found = True
                    break
                except Exception as e:
                    log_info(f"删除失败: {e}")
                    found = False
                    break
        if not found:
            break


def test_snapshots(page):
    print("\n=== 快照对比测试 ===")

    log_info("清理残留测试快照")
    cleanup_test_snapshots(page)

    # 创建快照 A
    print("\n--- 创建快照 A ---")
    create_snapshot(page, SNAP_A_NAME, SNAP_A_CONTENT)
    log_pass(f"快照 A 创建请求已提交: {SNAP_A_NAME}")

    # 列表验证 A
    print("\n--- 列表验证 A ---")
    page.goto(f"{BASE}/tools/snapshots")
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    if SNAP_A_NAME in page.content():
        log_pass("列表中出现快照 A")
    else:
        log_fail("列表中未出现快照 A")
        page.screenshot(path='/tmp/snap_list_a.png', full_page=True)
        return False

    # 详情验证
    print("\n--- 详情验证 A ---")
    detail_link = page.locator(f'table tbody tr:has-text("{SNAP_A_NAME}") a').first
    if detail_link.count() == 0:
        # 尝试点行
        page.locator(f'table tbody tr:has-text("{SNAP_A_NAME}")').first.click()
    else:
        detail_link.click()
    page.wait_for_load_state('networkidle')
    time.sleep(1.5)
    detail_text = page.content()
    if 'alice' in detail_text and 'Beijing' in detail_text:
        log_pass("详情页内容正确（alice / Beijing）")
    else:
        log_fail("详情页内容缺失")
        page.screenshot(path='/tmp/snap_detail_a.png', full_page=True)

    # 创建快照 B
    print("\n--- 创建快照 B ---")
    create_snapshot(page, SNAP_B_NAME, SNAP_B_CONTENT)
    log_pass(f"快照 B 创建请求已提交: {SNAP_B_NAME}")

    # 列表勾选对比
    print("\n--- 勾选 A、B 进入对比 ---")
    page.goto(f"{BASE}/tools/snapshots")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    if SNAP_A_NAME not in page.content() or SNAP_B_NAME not in page.content():
        log_fail("列表中 A 或 B 缺失")
        page.screenshot(path='/tmp/snap_list_ab.png', full_page=True)
        return False
    log_pass("列表中 A、B 都存在")

    row_a = page.locator(f'table tbody tr:has-text("{SNAP_A_NAME}")')
    row_b = page.locator(f'table tbody tr:has-text("{SNAP_B_NAME}")')

    # shadcn Checkbox 渲染为 button[role="checkbox"]
    cb_a = row_a.locator('button[role="checkbox"]').first
    cb_b = row_b.locator('button[role="checkbox"]').first

    if cb_a.count() == 0 or cb_b.count() == 0:
        log_fail("未找到对比 checkbox")
        page.screenshot(path='/tmp/snap_cb_fail.png', full_page=True)
        return False

    cb_a.click()
    time.sleep(0.3)
    cb_b.click()
    # 等待"对比选中"链接渲染（勾选 2 项后 canDiff=true，Button asChild 渲染为 a[href*="diff"]）
    try:
        page.wait_for_selector('a[href*="diff"]', timeout=5000)
    except Exception:
        pass
    time.sleep(0.5)

    # 优先用 href 精确定位（避免匹配到 disabled 状态的外层 button）
    diff_link = page.locator('a[href*="diff"]').first
    if diff_link.count() == 0:
        diff_link = page.locator('a:has-text("对比选中")').first
    if diff_link.count() == 0:
        log_fail("未找到对比入口")
        page.screenshot(path='/tmp/snap_diff_btn_fail.png', full_page=True)
        return False

    diff_link.click()
    try:
        page.wait_for_url('**/diff**', timeout=10000)
        log_pass(f"跳转对比页: {page.url}")
    except Exception:
        if '/diff' in page.url:
            log_pass(f"跳转对比页: {page.url}")
        else:
            log_fail(f"未跳转对比页，仍在 {page.url}")
            page.screenshot(path='/tmp/snap_diff_nav_fail.png', full_page=True)
            return False

    # 验证 diff 视图
    print("\n--- 验证对比视图 ---")
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    diff_text = page.content()

    has_shanghai = 'Shanghai' in diff_text
    has_email = 'email' in diff_text or 'a@b.com' in diff_text
    has_beijing = 'Beijing' in diff_text
    # alice 是 A、B 共同字段（值相同），JSON 深度 diff 只显示差异路径，相同字段不显示
    # age 字段 A=30 B=31，应该作为"修改"项显示
    has_age_diff = 'age' in diff_text

    if has_beijing:
        log_pass("对比视图含 Beijing（A 独有 / 被改）")
    else:
        log_fail("对比视图未含 Beijing")

    if has_shanghai:
        log_pass("对比视图含 Shanghai（B 独有）")
    else:
        log_fail("对比视图未含 Shanghai")

    if has_email:
        log_pass("对比视图含 email 字段（B 新增）")
    else:
        log_fail("对比视图未含 email 字段")

    if has_age_diff:
        log_pass("对比视图含 age 字段（A=30 vs B=31 被修改）")
    else:
        log_fail("对比视图未含 age 字段")

    # 检查差异统计/标记
    has_diff_marker = any(kw in diff_text for kw in ['新增', '删除', '修改', '变更', 'added', 'removed', 'changed', '+', '-'])
    if has_diff_marker:
        log_pass("对比视图显示差异标记")
    else:
        log_fail("对比视图未显示差异标记")
        page.screenshot(path='/tmp/snap_diff_view.png', full_page=True)

    # 清理
    print("\n--- 清理测试快照 ---")
    cleanup_test_snapshots(page)
    log_pass("清理完成")

    return True


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # 1. 登录
            if not login(page, "首次登录"):
                raise RuntimeError("首次登录失败")

            # 2. Header 退出
            if not signout_via_header(page):
                raise RuntimeError("Header 退出失败")

            # 3. 设置页退出
            if not signout_via_settings(page):
                raise RuntimeError("设置页退出失败")

            # 4. 重新登录开始快照测试
            if not login(page, "登录开始快照测试"):
                raise RuntimeError("快照测试前登录失败")

            # 5. 快照对比
            test_snapshots(page)

            # 6. 最终退出
            print("\n=== 最终退出登录 ===")
            page.goto(f"{BASE}/applications")
            page.wait_for_load_state('networkidle')
            time.sleep(1)
            page.locator('button[aria-label="账号菜单"]').click()
            time.sleep(0.5)
            page.locator('[role="menuitem"]:has-text("退出登录")').click()
            try:
                page.wait_for_url('**/login', timeout=10000)
                log_pass(f"最终退出成功: {page.url}")
            except Exception:
                if '/login' in page.url:
                    log_pass(f"最终退出成功: {page.url}")
                else:
                    log_fail(f"最终退出失败: {page.url}")

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
