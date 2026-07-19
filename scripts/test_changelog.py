"""
Changelog 模块端到端自测脚本

测试流程：
1. 登录
2. 列表页验证（标题、空状态或列表）
3. 创建一条 Changelog（含 2 条变更：NEW + FIX）
4. 列表验证（出现新条目）
5. 详情页验证（版本、变更分组、变更描述）
6. 编辑（改版本号，加第 3 条变更 IMPROVED）
7. 详情页验证编辑结果
8. 删除（从详情页危险操作区）
9. 列表验证已删除
10. 退出登录
"""
from playwright.sync_api import sync_playwright
import time
import re

BASE = "http://localhost:3000"
EMAIL = "test@jobtracks.com"
PASSWORD = "123456"

CL_VERSION = "TEST_CL_v1.0.0"
CL_VERSION_EDITED = "TEST_CL_v1.0.1"
CL_CHANGE_1 = "新增 Changelog 模块基础功能"
CL_CHANGE_2 = "修复列表分页边界问题"
CL_CHANGE_3 = "优化详情页变更分组展示"

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
            log_fail("登录失败，仍在 /login")
            return False


def cleanup_test_changelogs(page):
    """删除所有 TEST_CL_ 开头的 Changelog"""
    while True:
        page.goto(f"{BASE}/tools/changelog")
        page.wait_for_load_state('networkidle')
        time.sleep(0.5)
        rows = page.locator('table tbody tr').all()
        found = False
        for row in rows:
            try:
                text = row.text_content() or ''
            except Exception:
                break
            if 'TEST_CL_' in text:
                del_btn = row.locator('button[title="删除"]')
                if del_btn.count() == 0:
                    del_btn = row.locator('button').last
                try:
                    del_btn.click()
                    time.sleep(0.5)
                    confirm = page.locator('button:has-text("删除")').last
                    if confirm.count() > 0:
                        confirm.click()
                    time.sleep(1)
                    found = True
                    break
                except Exception as e:
                    log_info(f"删除失败: {e}")
                    found = False
                    break
        if not found:
            break


def create_changelog(page, version, changes):
    """
    创建 Changelog
    changes: [(type, description), ...]
    type 是 'NEW' / 'FIX' / 'IMPROVED' / 'BREAKING'
    """
    page.goto(f"{BASE}/tools/changelog")
    page.wait_for_load_state('networkidle')
    time.sleep(0.5)

    page.locator('button:has-text("新建")').first.click()
    page.wait_for_selector('[role="dialog"]', timeout=5000)
    time.sleep(0.3)

    # 填版本号
    page.fill('#cl-version', version)
    time.sleep(0.2)

    # changes：默认已有一条，type 默认 NEW
    # 先填第一条 description
    first_ta = page.locator('textarea[placeholder="描述本次变更内容"]').first
    first_ta.fill(changes[0][1])
    time.sleep(0.2)

    # 如果第一条 type 不是 NEW，要切换
    if changes[0][0] != 'NEW':
        # 点击第一条的 Select trigger
        first_select = page.locator('[role="dialog"] button[role="combobox"]').first
        first_select.click()
        time.sleep(0.3)
        # 选目标项
        # 用 SelectItem 里的文本（中文 label）
        type_label_map = {'NEW': '新功能', 'FIX': '修复', 'IMPROVED': '优化', 'BREAKING': '破坏性'}
        page.locator(f'[role="option"]:has-text("{type_label_map[changes[0][0]]}")').click()
        time.sleep(0.2)

    # 添加剩余 changes
    for i, (ctype, desc) in enumerate(changes[1:], start=1):
        # 点击"新增一条"
        page.locator('button:has-text("新增一条")').first.click()
        time.sleep(0.2)
        # 找到第 i 条的 textarea（按顺序）
        tas = page.locator('textarea[placeholder="描述本次变更内容"]')
        tas.nth(i).fill(desc)
        time.sleep(0.2)
        # 切换 type（如果需要）
        if ctype != 'NEW':
            selects = page.locator('[role="dialog"] button[role="combobox"]')
            selects.nth(i).click()
            time.sleep(0.3)
            type_label_map = {'NEW': '新功能', 'FIX': '修复', 'IMPROVED': '优化', 'BREAKING': '破坏性'}
            page.locator(f'[role="option"]:has-text("{type_label_map[ctype]}")').click()
            time.sleep(0.2)

    # 提交
    page.locator('button[type="submit"]:has-text("创建")').first.click()
    try:
        page.wait_for_selector('[role="dialog"]', state='detached', timeout=5000)
    except Exception:
        pass
    time.sleep(1)


def test_create_and_list(page):
    print("\n=== 测试 1：创建 + 列表验证 ===")
    log_info("清理残留测试数据")
    cleanup_test_changelogs(page)

    print("\n--- 创建 Changelog ---")
    create_changelog(page, CL_VERSION, [
        ('NEW', CL_CHANGE_1),
        ('FIX', CL_CHANGE_2),
    ])
    log_pass(f"创建请求已提交: {CL_VERSION}")

    print("\n--- 列表验证 ---")
    page.goto(f"{BASE}/tools/changelog")
    page.wait_for_load_state('networkidle')
    time.sleep(1)
    content = page.content()
    if CL_VERSION in content:
        log_pass("列表中出现新创建的版本")
    else:
        log_fail("列表中未出现新版本")
        page.screenshot(path='/tmp/cl_list_fail.png', full_page=True)
        return False

    # 验证变更数 Badge 显示 2
    row = page.locator(f'table tbody tr:has-text("{CL_VERSION}")')
    badge = row.locator('td span').filter(has_text=re.compile(r'^\d+$')).first
    if badge.count() > 0:
        badge_text = badge.text_content() or ''
        if badge_text == '2':
            log_pass(f"变更数 Badge 显示 2")
        else:
            log_fail(f"变更数 Badge 显示 '{badge_text}'，期望 '2'")
    else:
        log_info("未找到变更数 Badge（可能选择器不匹配，跳过）")

    return True


def test_detail_view(page):
    print("\n=== 测试 2：详情页验证 ===")
    page.goto(f"{BASE}/tools/changelog")
    page.wait_for_load_state('networkidle')
    time.sleep(0.5)

    # 点版本号链接进详情
    page.locator(f'table tbody tr:has-text("{CL_VERSION}") a').first.click()
    page.wait_for_load_state('networkidle')
    time.sleep(3)  # 详情页是 SSR，给够渲染时间

    # 等待"变更内容"标题出现（确认 SSR 完成）
    try:
        page.wait_for_selector('text=变更内容', timeout=10000)
        log_pass("详情页 SSR 完成（出现'变更内容'标题）")
    except Exception:
        log_fail("详情页未出现'变更内容'标题")
        page.screenshot(path='/tmp/cl_detail_timeout.png', full_page=True)

    content = page.content()

    if CL_VERSION in content:
        log_pass(f"详情页显示版本号 {CL_VERSION}")
    else:
        log_fail("详情页未显示版本号")
        page.screenshot(path='/tmp/cl_detail_fail.png', full_page=True)
        return False

    if CL_CHANGE_1 in content:
        log_pass("详情页含第 1 条变更描述")
    else:
        log_fail("详情页未含第 1 条变更描述")

    if CL_CHANGE_2 in content:
        log_pass("详情页含第 2 条变更描述")
    else:
        log_fail("详情页未含第 2 条变更描述")

    # 验证按类型分组（页面应出现"新功能"和"修复"小标题）
    if '新功能' in content:
        log_pass("详情页含'新功能'分组标题")
    else:
        log_fail("详情页未含'新功能'分组标题")

    if '修复' in content:
        log_pass("详情页含'修复'分组标题")
    else:
        log_fail("详情页未含'修复'分组标题")

    return True


def test_edit(page):
    print("\n=== 测试 3：编辑 Changelog ===")
    # 当前在详情页
    # 点击"编辑"按钮
    edit_btn = page.locator('button:has-text("编辑")').first
    if edit_btn.count() == 0:
        log_fail("未找到编辑按钮")
        return False
    edit_btn.click()
    page.wait_for_selector('[role="dialog"]', timeout=5000)
    time.sleep(0.5)

    # 改版本号
    version_input = page.locator('#cl-version')
    version_input.fill('')
    version_input.fill(CL_VERSION_EDITED)
    time.sleep(0.2)

    # 加第 3 条变更（IMPROVED）
    page.locator('button:has-text("新增一条")').first.click()
    time.sleep(0.3)
    tas = page.locator('textarea[placeholder="描述本次变更内容"]')
    tas.nth(2).fill(CL_CHANGE_3)
    time.sleep(0.2)
    # 切换 type 到 IMPROVED（"优化"）
    selects = page.locator('[role="dialog"] button[role="combobox"]')
    selects.nth(2).click()
    time.sleep(0.3)
    page.locator('[role="option"]:has-text("优化")').click()
    time.sleep(0.2)

    # 提交（编辑模式按钮文字是"保存"）
    page.locator('button[type="submit"]:has-text("保存")').first.click()
    try:
        page.wait_for_selector('[role="dialog"]', state='detached', timeout=5000)
    except Exception:
        pass
    # router.refresh() 触发 SSR 重 fetch，等待新版本号出现
    try:
        page.wait_for_selector(f'text={CL_VERSION_EDITED}', timeout=10000)
        time.sleep(1)  # 额外等待 changes 区块渲染
    except Exception:
        time.sleep(3)

    # 验证详情页已更新
    content = page.content()
    if CL_VERSION_EDITED in content:
        log_pass(f"编辑后版本号已更新为 {CL_VERSION_EDITED}")
    else:
        log_fail(f"编辑后版本号未更新，仍在显示原版本")
        page.screenshot(path='/tmp/cl_edit_fail.png', full_page=True)

    if CL_CHANGE_3 in content:
        log_pass("编辑后新增的第 3 条变更已显示")
    else:
        log_fail("编辑后未显示新增的第 3 条变更")

    if '优化' in content:
        log_pass("详情页含'优化'分组标题")
    else:
        log_fail("详情页未含'优化'分组标题")

    return True


def test_delete(page):
    print("\n=== 测试 4：删除 Changelog ===")
    # 当前在详情页，找到危险操作区的删除按钮
    # 详情页底部有"删除此 Changelog"区域，里面有删除按钮
    page.goto(f"{BASE}/tools/changelog")
    page.wait_for_load_state('networkidle')
    time.sleep(0.5)

    # 进入详情页
    page.locator(f'table tbody tr:has-text("{CL_VERSION_EDITED}") a').first.click()
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 详情页底部危险操作区的删除按钮
    # 找包含"删除此 Changelog"文本附近的删除按钮
    delete_btn = page.locator('button:has-text("删除"):not([title="删除"])').last
    if delete_btn.count() == 0:
        # 退而求其次，找所有 destructive 按钮
        delete_btn = page.locator('button.variant-destructive, button[class*="destructive"]').last
    if delete_btn.count() == 0:
        log_fail("未找到详情页删除按钮")
        page.screenshot(path='/tmp/cl_delete_nobtn.png', full_page=True)
        return False

    delete_btn.click()
    time.sleep(0.5)

    # 确认对话框
    confirm = page.locator('button:has-text("删除")').last
    if confirm.count() > 0:
        confirm.click()
    time.sleep(2)

    # 应该跳回列表页
    if '/tools/changelog' in page.url and page.url.rstrip('/').endswith('/changelog'):
        log_pass(f"删除后跳回列表页: {page.url}")
    else:
        log_info(f"删除后 URL: {page.url}")

    # 列表验证已删除
    page.goto(f"{BASE}/tools/changelog")
    page.wait_for_load_state('networkidle')
    time.sleep(0.5)
    if CL_VERSION_EDITED not in page.content():
        log_pass("列表中已无被删除的版本")
    else:
        log_fail("列表中仍存在被删除的版本")
        page.screenshot(path='/tmp/cl_delete_fail.png', full_page=True)

    return True


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            if not login(page):
                raise RuntimeError("登录失败")

            # 测试 1：创建 + 列表
            test_create_and_list(page)

            # 测试 2：详情
            test_detail_view(page)

            # 测试 3：编辑
            test_edit(page)

            # 测试 4：删除
            test_delete(page)

            # 最终退出
            print("\n=== 退出登录 ===")
            page.goto(f"{BASE}/applications")
            page.wait_for_load_state('networkidle')
            time.sleep(1)
            page.locator('button[aria-label="账号菜单"]').click()
            time.sleep(0.5)
            page.locator('[role="menuitem"]:has-text("退出登录")').click()
            try:
                page.wait_for_url('**/login', timeout=10000)
                log_pass(f"退出登录成功: {page.url}")
            except Exception:
                if '/login' in page.url:
                    log_pass(f"退出登录成功: {page.url}")
                else:
                    log_fail(f"退出登录失败: {page.url}")

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
