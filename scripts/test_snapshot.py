"""
快照模块端到端自测脚本

测试流程：
1. 登录（用 Enter 键提交）
2. 创建快照 A（JSON）
3. 列表验证：确认快照 A 出现
4. 详情页验证：点进详情页，确认内容显示
5. 创建快照 B（JSON，内容略有不同）
6. 列表勾选 A 和 B，进入对比页
7. 对比页验证：确认 diff 视图渲染
8. 清理：删除快照 A 和 B
"""
from playwright.sync_api import sync_playwright
import time

BASE = "http://localhost:3000"
EMAIL = "test@jobtracks.dev"
PASSWORD = "test123456"

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

def login(page):
    """登录"""
    print("\n=== 1. 登录 ===")
    page.goto(f"{BASE}/login")
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    page.fill('#email', EMAIL)
    page.fill('#password', PASSWORD)
    time.sleep(0.3)
    page.press('#password', 'Enter')
    # 等待跳转离开 /login
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

def cleanup_test_snapshots(page):
    """删除所有 TEST_SNAP_ 开头的快照（每次删除后重新加载页面避免 locator 失效）"""
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
                if del_btn.count() > 0:
                    del_btn.first.click()
                    time.sleep(0.5)
                    confirm_btn = page.locator('button:has-text("删除")').last
                    if confirm_btn.count() > 0:
                        confirm_btn.click()
                        time.sleep(1)
                        log_info(f"清理: {text[:40]}")
                        found = True
                        break
            if found:
                break
        if not found:
            break

def create_snapshot(page, name, content):
    """创建快照"""
    page.click('button:has-text("新建")')
    page.wait_for_selector('input[placeholder*="v1.2.0"]', timeout=5000)
    page.fill('input[placeholder*="v1.2.0"]', name)
    page.fill('textarea[placeholder*="JSON"]', content)
    page.click('button[type="submit"]:has-text("创建")')
    time.sleep(1.5)
    page.wait_for_load_state('networkidle')

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 900})
        page = context.new_page()

        # 1. 登录
        if not login(page):
            browser.close()
            return

        # 2. 前往快照页 + 清理旧数据
        print("\n=== 2. 前往快照页 ===")
        page.goto(f"{BASE}/tools/snapshots")
        page.wait_for_load_state('networkidle')
        time.sleep(1)
        cleanup_test_snapshots(page)

        # 3. 创建快照 A
        print("\n=== 3. 创建快照 A ===")
        create_snapshot(page, SNAP_A_NAME, SNAP_A_CONTENT)
        page_content = page.content()
        if SNAP_A_NAME in page_content:
            log_pass("快照 A 出现在列表中")
        else:
            log_fail("快照 A 未出现在列表中")
            page.screenshot(path='/tmp/snap_create_a.png', full_page=True)

        # 4. 详情页验证
        print("\n=== 4. 详情页验证 ===")
        page.click(f'a:has-text("{SNAP_A_NAME}")')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        detail_content = page.content()
        if SNAP_A_NAME in detail_content and 'Beijing' in detail_content:
            log_pass("详情页显示名称和内容")
        else:
            log_fail("详情页内容不正确")
            page.screenshot(path='/tmp/snap_detail.png', full_page=True)
        # 返回列表
        page.go_back()
        page.wait_for_load_state('networkidle')
        time.sleep(0.5)

        # 5. 创建快照 B
        print("\n=== 5. 创建快照 B ===")
        create_snapshot(page, SNAP_B_NAME, SNAP_B_CONTENT)
        page_content = page.content()
        if SNAP_B_NAME in page_content:
            log_pass("快照 B 出现在列表中")
        else:
            log_fail("快照 B 未出现在列表中")

        # 6. 勾选对比
        print("\n=== 6. 勾选两个快照进行对比 ===")
        # 勾选包含 TEST_SNAP 的行
        rows = page.locator('table tbody tr').all()
        checked = 0
        for row in rows:
            text = row.text_content() or ''
            if SNAP_A_NAME in text or SNAP_B_NAME in text:
                cb = row.locator('[role="checkbox"]')
                if cb.count() > 0:
                    cb.first.click()
                    checked += 1
                    log_info(f"勾选: {text[:40]}")
        log_info(f"共勾选 {checked} 个")

        time.sleep(0.5)
        # 点对比按钮
        compare_link = page.locator('a:has-text("对比选中")')
        compare_btn = page.locator('button:has-text("对比选中")')
        if compare_link.count() > 0:
            compare_link.first.click()
            log_pass("点击对比链接")
        elif compare_btn.count() > 0:
            compare_btn.first.click()
            log_pass("点击对比按钮")
        else:
            log_fail("未找到对比按钮")

        # 7. 对比页验证
        print("\n=== 7. 对比页验证 ===")
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        diff_content = page.content()
        page.screenshot(path='/tmp/snap_diff.png', full_page=True)

        checks = [
            ("快照 A 名称", SNAP_A_NAME in diff_content),
            ("快照 B 名称", SNAP_B_NAME in diff_content),
            ("Shanghai(B独有)", 'Shanghai' in diff_content),
            ("email字段(B独有)", 'email' in diff_content),
        ]
        for name, ok in checks:
            if ok:
                log_pass(name)
            else:
                log_fail(name)

        # 8. 清理
        print("\n=== 8. 清理测试数据 ===")
        page.goto(f"{BASE}/tools/snapshots")
        page.wait_for_load_state('networkidle')
        time.sleep(0.5)
        cleanup_test_snapshots(page)

        browser.close()

        print(f"\n=== 测试结果 ===")
        print(f"通过: {passed}  失败: {failed}")

if __name__ == '__main__':
    main()
