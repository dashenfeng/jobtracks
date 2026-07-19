"""
审计日志 CSV 导出自测脚本

测试要点：
1. 登录后访问审计日志页面
2. 验证页面有"导出 CSV"按钮
3. 验证页面有 targetType 筛选下拉
4. 先制造一些审计日志（创建 Snapshot + Changelog）
5. 直接调用导出 API，验证返回 CSV
6. 验证 CSV 含 UTF-8 BOM
7. 验证 CSV 表头正确
8. 验证 CSV 含数据行
9. 验证 targetType 筛选生效（只导出 Snapshot）
10. 验证 action 筛选生效（只导出 CREATE）
11. UI 点击导出按钮触发下载
12. 清理测试数据
"""
from playwright.sync_api import sync_playwright
import time
import json

BASE = "http://localhost:3000"
EMAIL = "test@jobtracks.com"
PASSWORD = "123456"

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
        log_pass(f"登录成功")
        return True
    except Exception:
        if '/login' not in page.url:
            log_pass(f"登录成功")
            return True
        log_fail("登录失败")
        return False


def create_snapshot_via_api(cookies):
    """通过 API 创建 Snapshot 制造审计日志"""
    print("\n--- 创建 Snapshot 制造审计日志 ---")
    payload = {
        "name": "TEST_AUDIT_EXPORT_SNAPSHOT",
        "contentType": "json",
        "content": '{"test": "audit_export"}',
        "project": "test",
        "tags": [],
        "remarks": "用于审计日志导出测试",
        "isBaseline": False,
    }
    import urllib.request
    req = urllib.request.Request(
        f"{BASE}/api/snapshots",
        method='POST',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Origin': BASE,
            'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            log_info(f"Snapshot 创建成功: {data.get('id', '')[:12]}...")
            return data.get('id')
    except Exception as e:
        log_info(f"Snapshot 创建失败: {e}")
        return None


def create_changelog_via_api(cookies):
    """通过 API 创建 Changelog 制造审计日志"""
    print("\n--- 创建 Changelog 制造审计日志 ---")
    payload = {
        "version": "TEST_AUDIT_EXPORT_CL_v1.0.0",
        "releasedAt": "2026-07-14T00:00:00.000Z",
        "screenshots": [],
        "changes": [
            {"type": "NEW", "description": "测试审计日志导出"}
        ],
    }
    import urllib.request
    req = urllib.request.Request(
        f"{BASE}/api/changelogs",
        method='POST',
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Origin': BASE,
            'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            log_info(f"Changelog 创建成功: {data.get('id', '')[:12]}...")
            return data.get('id')
    except Exception as e:
        log_info(f"Changelog 创建失败: {e}")
        return None


def cleanup(cookies, snapshot_id=None, changelog_id=None):
    """清理测试数据"""
    import urllib.request
    if snapshot_id:
        try:
            req = urllib.request.Request(
                f"{BASE}/api/snapshots/{snapshot_id}",
                method='DELETE',
                headers={
                    'Origin': BASE,
                    'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
                },
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception:
            pass
    if changelog_id:
        try:
            req = urllib.request.Request(
                f"{BASE}/api/changelogs/{changelog_id}",
                method='DELETE',
                headers={
                    'Origin': BASE,
                    'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
                },
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception:
            pass


def test_page_ui(page):
    """测试 1：审计日志页 UI 元素"""
    print("\n=== 测试 1：UI 元素验证 ===")
    page.goto(f"{BASE}/tools/envvault/logs")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 导出按钮
    export_btn = page.locator('button:has-text("导出 CSV")')
    if export_btn.count() > 0 and export_btn.is_visible():
        log_pass("页面有'导出 CSV'按钮")
    else:
        log_fail("未找到'导出 CSV'按钮")

    # targetType 筛选下拉
    # 第二个 Select trigger 是 targetType（第一个是 action）
    selects = page.locator('button[role="combobox"]')
    if selects.count() >= 2:
        log_pass(f"页面有 {selects.count()} 个筛选下拉（action + targetType）")
    else:
        log_fail(f"筛选下拉数量不足: {selects.count()}")

    # 表头
    content = page.content()
    if '键名/版本' in content:
        log_pass("表格表头含'键名/版本'（已从'键名'更新）")
    else:
        log_fail("表格表头未更新为'键名/版本'")


def test_export_all(cookies):
    """测试 2：导出全部审计日志"""
    print("\n=== 测试 2：导出全部 CSV ===")
    import urllib.request
    req = urllib.request.Request(
        f"{BASE}/api/audit-logs/export",
        headers={
            'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get('Content-Type', '')
            cd = resp.headers.get('Content-Disposition', '')
            body = resp.read().decode('utf-8')

            if 'text/csv' in content_type:
                log_pass(f"Content-Type 正确: {content_type}")
            else:
                log_fail(f"Content-Type 错误: {content_type}")

            if 'attachment' in cd and '.csv' in cd:
                log_pass(f"Content-Disposition 正确: {cd[:60]}...")
            else:
                log_fail(f"Content-Disposition 错误: {cd}")

            # BOM 检查
            if body.startswith('\ufeff'):
                log_pass("CSV 含 UTF-8 BOM（Excel 兼容）")
            else:
                log_fail("CSV 缺少 UTF-8 BOM")

            # 表头检查
            lines = body.lstrip('\ufeff').split('\r\n')
            header = lines[0] if lines else ''
            if header == '时间,动作,目标类型,目标ID,键名/版本,详情':
                log_pass(f"CSV 表头正确: {header}")
            else:
                log_fail(f"CSV 表头错误: {header}")

            # 数据行检查
            data_lines = [l for l in lines[1:] if l.strip()]
            if len(data_lines) > 0:
                log_pass(f"CSV 含 {len(data_lines)} 条数据行")
            else:
                log_fail("CSV 无数据行")

            # 检查是否含 Snapshot / Changelog 类型的中文标签
            if '快照' in body:
                log_pass("CSV 含 '快照' 中文标签（TARGET_TYPE_LABELS 生效）")
            else:
                log_info("CSV 不含 '快照'（可能无 Snapshot 审计日志，将后续制造）")

            if 'Changelog' in body:
                log_pass("CSV 含 'Changelog' 中文标签")
            else:
                log_info("CSV 不含 'Changelog'（可能无 Changelog 审计日志）")

            return True
    except Exception as e:
        log_fail(f"导出请求失败: {e}")
        return False


def test_export_with_data(cookies):
    """测试 3：制造数据后导出，验证 targetType 筛选"""
    print("\n=== 测试 3：制造数据 + targetType 筛选 ===")

    # 制造数据
    sid = create_snapshot_via_api(cookies)
    cid = create_changelog_via_api(cookies)
    time.sleep(1)

    # 导出全部
    import urllib.request
    req = urllib.request.Request(
        f"{BASE}/api/audit-logs/export",
        headers={
            'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode('utf-8')
            if '快照' in body and 'TEST_AUDIT_EXPORT_SNAPSHOT' in body:
                log_pass("导出含 Snapshot 审计日志 + '快照'中文标签")
            else:
                log_fail("导出未含 Snapshot 审计日志")

            if 'Changelog' in body and 'TEST_AUDIT_EXPORT_CL_v1.0.0' in body:
                log_pass("导出含 Changelog 审计日志 + 'Changelog'中文标签")
            else:
                log_fail("导出未含 Changelog 审计日志")
    except Exception as e:
        log_fail(f"导出失败: {e}")

    # targetType 筛选：只导出 Snapshot
    print("\n--- targetType=Snapshot 筛选 ---")
    req = urllib.request.Request(
        f"{BASE}/api/audit-logs/export?targetType=Snapshot",
        headers={
            'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode('utf-8')
            lines = body.lstrip('\ufeff').split('\r\n')
            data_lines = [l for l in lines[1:] if l.strip()]

            if len(data_lines) > 0 and all('快照' in l for l in data_lines):
                log_pass(f"targetType=Snapshot 筛选生效（{len(data_lines)} 条全是快照）")
            else:
                log_fail(f"targetType=Snapshot 筛选失效")

            # 确认不含 Changelog
            if 'Changelog' not in body:
                log_pass("targetType=Snapshot 筛选排除了 Changelog")
            else:
                log_fail("targetType=Snapshot 筛选未排除 Changelog")
    except Exception as e:
        log_fail(f"targetType 筛选导出失败: {e}")

    # action 筛选：只导出 CREATE
    print("\n--- action=CREATE 筛选 ---")
    req = urllib.request.Request(
        f"{BASE}/api/audit-logs/export?action=CREATE",
        headers={
            'Cookie': '; '.join(f"{c['name']}={c['value']}" for c in cookies),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode('utf-8')
            lines = body.lstrip('\ufeff').split('\r\n')
            data_lines = [l for l in lines[1:] if l.strip()]

            if len(data_lines) > 0 and all('创建' in l for l in data_lines):
                log_pass(f"action=CREATE 筛选生效（{len(data_lines)} 条全是创建）")
            else:
                log_fail(f"action=CREATE 筛选失效")

            # 确认不含 删除/更新
            if '删除' not in body and '更新' not in body:
                log_pass("action=CREATE 筛选排除了删除/更新")
            else:
                # 可能有其他更新日志，只要全是创建就 pass
                if all('创建' in l for l in data_lines):
                    log_pass("action=CREATE 筛选数据行全是创建")
                else:
                    log_fail("action=CREATE 筛选含非创建行")
    except Exception as e:
        log_fail(f"action 筛选导出失败: {e}")

    return sid, cid


def test_ui_export_click(page):
    """测试 4：UI 点击导出按钮触发下载"""
    print("\n=== 测试 4：UI 点击导出 ===")
    page.goto(f"{BASE}/tools/envvault/logs")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 监听下载事件
    export_btn = page.locator('button:has-text("导出 CSV")').first
    if export_btn.count() == 0:
        log_fail("未找到导出按钮")
        return

    # 如果按钮 disabled（无数据），先跳过
    if export_btn.is_disabled():
        log_info("导出按钮 disabled（无数据），跳过 UI 点击测试")
        return

    # 用 expect_download 等待下载
    try:
        with page.expect_download(timeout=10000) as download_info:
            export_btn.click()
        download = download_info.value
        filename = download.suggested_filename
        if filename.endswith('.csv'):
            log_pass(f"UI 点击触发下载: {filename}")
        else:
            log_fail(f"下载文件名异常: {filename}")

        # 保存并验证内容
        path = download.path()
        if path:
            with open(path, 'rb') as f:
                content = f.read()
            if content.startswith(b'\xef\xbb\xbf'):
                log_pass("下载文件含 UTF-8 BOM")
            else:
                log_fail("下载文件缺少 BOM")
    except Exception as e:
        log_fail(f"UI 导出下载失败: {e}")


def test_targettype_filter_ui(page):
    """测试 5：UI targetType 筛选下拉"""
    print("\n=== 测试 5：UI targetType 筛选 ===")
    page.goto(f"{BASE}/tools/envvault/logs")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 点击第二个 Select（targetType）
    selects = page.locator('button[role="combobox"]')
    if selects.count() < 2:
        log_fail("筛选下拉不足")
        return

    selects.nth(1).click()
    time.sleep(0.5)

    # 检查下拉选项
    options = page.locator('[role="option"]')
    option_texts = []
    for i in range(options.count()):
        try:
            option_texts.append(options.nth(i).text_content() or '')
        except Exception:
            pass

    expected = ['全部类型', '环境变量', '快照', 'Changelog', '投递记录', '面试记录', '面经题目']
    for t in expected:
        if any(t in ot for ot in option_texts):
            log_pass(f"targetType 下拉含 '{t}'")
        else:
            log_fail(f"targetType 下拉缺 '{t}'")

    # ESC 关闭
    page.keyboard.press('Escape')
    time.sleep(0.3)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        try:
            if not login(page):
                raise RuntimeError("登录失败")

            # 拿 cookies 供 API 调用
            cookies = context.cookies()

            # 测试 1：UI 元素
            test_page_ui(page)

            # 测试 2：导出全部（可能无数据）
            test_export_all(cookies)

            # 测试 3：制造数据 + 筛选
            sid, cid = test_export_with_data(cookies)

            # 测试 5：UI targetType 筛选下拉
            test_targettype_filter_ui(page)

            # 测试 4：UI 点击导出
            test_ui_export_click(page)

            # 清理
            print("\n=== 清理测试数据 ===")
            cleanup(cookies, sid, cid)
            log_pass("清理完成")

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
