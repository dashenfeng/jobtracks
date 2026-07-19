"""
AI Agent 模块自测脚本

测试要点：
1. 登录后页面顶部有 "AI 助手" 导航项
2. 进入 /ai-agent，页面正常渲染（标题、副标题、空状态示例）
3. 输入框、发送按钮、清空按钮存在
4. 发送一条问候消息，验证 AI 流式回复（非空文本）
5. 验证工具调用：问一个需要查询数据的问题，看到工具调用气泡
6. 验证清空对话功能
7. 验证未登录访问 /api/ai-agent 返回 401
8. 验证 CSRF：缺少 Origin 头返回 403
"""
from playwright.sync_api import sync_playwright
import json
import time
import urllib.request

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
        log_pass("登录成功")
        return True
    except Exception:
        if '/login' not in page.url:
            log_pass("登录成功")
            return True
        log_fail("登录失败")
        return False


def test_nav_item(page):
    print("\n=== 测试导航项 ===")
    # 桌面端侧边栏
    sidebar = page.locator('aside')
    if sidebar.get_by_text('AI 助手').count() > 0:
        log_pass("侧边栏有 AI 助手导航项")
    else:
        log_fail("侧边栏未找到 AI 助手导航项")


def test_page_render(page):
    print("\n=== 测试页面渲染 ===")
    page.goto(f"{BASE}/ai-agent")
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    # 标题
    if page.get_by_role('heading', level=1, name='AI 助手').count() > 0:
        log_pass("页面标题正确")
    else:
        log_fail("页面标题未找到")

    # 副标题
    if page.get_by_text('只读分析').count() > 0:
        log_pass("副标题存在")
    else:
        log_fail("副标题未找到")

    # 空状态：示例问题
    if page.get_by_text('问点什么吧').count() > 0:
        log_pass("空状态示例存在")
    else:
        log_fail("空状态示例未找到")

    # 输入框
    textarea = page.locator('textarea')
    if textarea.count() > 0:
        log_pass("输入框存在")
    else:
        log_fail("输入框未找到")

    # 发送按钮（初始 disabled，因为输入为空）
    send_btn = page.locator('button[aria-label="发送"]')
    if send_btn.count() > 0:
        log_pass("发送按钮存在")
    else:
        log_fail("发送按钮未找到")


def test_simple_chat(page):
    """测试简单对话（不依赖工具调用）"""
    print("\n=== 测试简单对话 ===")
    # 输入消息
    textarea = page.locator('textarea')
    textarea.fill('你好，你是谁？')
    time.sleep(0.3)

    # 发送
    page.locator('button[aria-label="发送"]').click()

    try:
        # 等到用户消息出现
        page.wait_for_selector('text=你好，你是谁？', timeout=5000)
        log_pass("用户消息显示在列表中")

        # 等 AI 回复完成：
        # 流式过程中显示「停止生成」按钮，结束后变为「发送」按钮
        deadline = time.time() + 45
        ai_responded = False
        while time.time() < deadline:
            # 发送按钮存在且可用 = 流式结束
            if page.locator('button[aria-label="发送"]').count() > 0 and \
               page.locator('[class*="rounded-2xl"]').count() >= 2:
                ai_responded = True
                break
            time.sleep(1)

        if ai_responded:
            log_pass("AI 回复完成")
        else:
            log_fail("AI 未回复（超时 45s）")
    except Exception as e:
        log_fail(f"对话异常: {e}")


def test_tool_call(page):
    """测试工具调用：问一个需要工具的问题"""
    print("\n=== 测试工具调用 ===")
    # 先清空对话
    clear_btn = page.locator('button:has-text("清空")')
    if clear_btn.is_enabled():
        clear_btn.click()
        time.sleep(0.5)

    # 问一个需要工具的问题
    textarea = page.locator('textarea')
    textarea.fill('我现在有多少投递记录？')
    time.sleep(0.3)
    page.locator('button[aria-label="发送"]').click()

    # 等待工具调用气泡出现（最多 45 秒）
    deadline = time.time() + 45
    tool_invoked = False
    while time.time() < deadline:
        # 工具气泡含 "查询" 文字
        if page.get_by_text('查询投递统计').count() > 0 or \
           page.get_by_text('查询投递列表').count() > 0 or \
           page.get_by_text('已查询').count() > 0:
            tool_invoked = True
            break
        time.sleep(1)

    if tool_invoked:
        log_pass("工具被调用")
    else:
        log_fail("工具未触发（超时 45s）")

    # 等待整个回复完成（最多再等 30 秒）
    deadline2 = time.time() + 30
    while time.time() < deadline2:
        if page.locator('button[aria-label="发送"]').count() > 0:
            break
        time.sleep(1)


def test_clear(page):
    """测试清空对话"""
    print("\n=== 测试清空对话 ===")
    clear_btn = page.locator('button:has-text("清空")')
    if not clear_btn.is_enabled():
        log_fail("清空按钮不可用")
        return
    clear_btn.click()
    time.sleep(0.5)

    # 验证回到空状态
    if page.get_by_text('问点什么吧').count() > 0:
        log_pass("清空后回到空状态")
    else:
        log_fail("清空失败")


def test_api_unauthenticated():
    """测试未登录访问 API 返回 401"""
    print("\n=== 测试未登录访问 API ===")
    try:
        data = json.dumps({"messages": []}).encode('utf-8')
        req = urllib.request.Request(
            f"{BASE}/api/ai-agent",
            data=data,
            headers={'Content-Type': 'application/json', 'Origin': BASE},
            method='POST'
        )
        urllib.request.urlopen(req, timeout=5)
        log_fail("未登录请求未拒绝")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            log_pass("未登录访问返回 401")
        else:
            log_fail(f"未登录访问返回 {e.code}")
    except Exception as e:
        log_fail(f"请求异常: {e}")


def test_csrf_missing_origin(cookies):
    """测试缺少 Origin 头返回 403（CSRF）"""
    print("\n=== 测试 CSRF 保护 ===")
    try:
        data = json.dumps({"messages": []}).encode('utf-8')
        req = urllib.request.Request(
            f"{BASE}/api/ai-agent",
            data=data,
            headers={'Content-Type': 'application/json'},  # 故意不带 Origin
            method='POST'
        )
        # 携带 session cookie
        for c in cookies:
            req.add_header('Cookie', f'{c["name"]}={c["value"]}')
        urllib.request.urlopen(req, timeout=5)
        log_fail("缺少 Origin 未被拒绝")
    except urllib.error.HTTPError as e:
        if e.code == 403:
            log_pass("缺少 Origin 返回 403")
        else:
            log_fail(f"缺少 Origin 返回 {e.code}（期望 403）")
    except Exception as e:
        log_fail(f"请求异常: {e}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        if not login(page):
            print("\n登录失败，终止测试")
            browser.close()
            return

        # 收集 cookies 给后续 API 测试用
        cookies = context.cookies()

        test_nav_item(page)
        test_page_render(page)
        test_simple_chat(page)
        test_tool_call(page)
        test_clear(page)

        browser.close()

    # API 层测试
    test_api_unauthenticated()
    test_csrf_missing_origin(cookies)

    print(f"\n=== 测试结束 ===")
    print(f"通过: {passed}")
    print(f"失败: {failed}")
    if failed == 0:
        print("全部通过 ✅")
    else:
        print("有失败用例 ❌")


if __name__ == '__main__':
    main()
