addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
      const url = new URL(request.url);

      // 如果访问根目录，返回HTML
      if (url.pathname === "/") {
          return new Response(getRootHtml(), {
              headers: {
                  'Content-Type': 'text/html; charset=utf-8'
              }
          });
      }

      // 从请求路径中提取目标 URL
      let actualUrlStr = decodeURIComponent(url.pathname.replace("/", ""));


      // 判断用户输入的 URL 是否带有协议
      actualUrlStr = ensureProtocol(actualUrlStr, url.protocol);

      // 检查白名单 白名单检查 如果实在怕你就打开吧 这里面是我当时给允许的
      //const allowedDomains = ["github.com",
//      "collector.github.com",
//      "about.gitlab.com",
//      "gitlab.com",
//      "objects.githubusercontent.com",
//      "translate.google.com",
//      "bing.com",
//      "www.bing.com",
//      "ipip.net",
//      "myip.ipip.net",
//      "kaialist.top",
//      "www.kaialist.top",
//      "kcraftnetwork.xyz",
//      "alist.kcraftnetwork.xyz",
//      "github.io",
//      "githubusercontent.com",
//      "maven.google.com",
//      "maven.apache.org",
//      "cs.android.com",
//      "hub.docker.org",
//      "docker.org",
//      "apache.org",
//      ""]; // 白名单
      // const targetUrl = new URL(actualUrlStr);
      // const targetHostname = targetUrl.hostname;

      // 检查是否在白名单
      //if (!allowedDomains.includes(targetHostname)) {
      //    return new Response("HTTP 502 Bad Gateway", { status: 502 });
      //}
      // 如果搜索引擎爬虫 返回robots.txt
      const specificChars = ["robots.txt"];
      if (specificChars.some(char => url.href.includes(char))) {
          return new Response("User-agent: * \nDisallow: /", { status: 200 });
      }

      // 检查目标 URL 是否包含特定字符，返回 403
      const forbiddenChars = ["login", "signup", "robots", "@login", "freefq", "porn", "hentai", "youtube", "www.google.com", "google.com"]; // 替换为实际字符
      if (forbiddenChars.some(char => actualUrlStr.includes(char))) {
          return new Response("HTTP 403 Forbidden", { status: 403 });
      }
      
      // 保留查询参数
      actualUrlStr += url.search;

      // 创建新 Headers 对象，排除以 'cf-' 开头的请求头
      const newHeaders = filterHeaders(request.headers, name => !name.startsWith('cf-'));

      // 创建一个新的请求以访问目标 URL
      const modifiedRequest = new Request(actualUrlStr, {
          headers: newHeaders,
          method: request.method,
          body: request.body,
          redirect: 'manual'
      });

      // 发起对目标 URL 的请求
      const response = await fetch(modifiedRequest);
      let body = response.body;

      // 处理重定向
      if ([301, 302, 303, 307, 308].includes(response.status)) {
          body = response.body;
          // 创建新的 Response 对象以修改 Location 头部
          return handleRedirect(response, body);
      } else if (response.headers.get("Content-Type")?.includes("text/html")) {
          body = await handleHtmlContent(response, url.protocol, url.host, actualUrlStr);
      }

      // 创建修改后的响应对象
      const modifiedResponse = new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
      });

    // 设置禁用缓存的头部
    function setNoCacheHeaders(headers) {
    headers.set('Cache-Control', 'no-store');
    }

        return modifiedResponse;
    } catch (error) {
        // 如果请求目标地址时出现错误，返回带有错误消息的响应和状态码 500（服务器错误）
        return jsonResponse({
          error: error.message
        }, 500);
  }
}
    // 设置 CORS 头部
    function setCorsHeaders(headers) {
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      headers.set('Access-Control-Allow-Headers', '*');
}
  // 确保 URL 带有协议
  function ensureProtocol(url, defaultProtocol) {
    return url.startsWith("http://") || url.startsWith("https://") ? url : defaultProtocol + "//" + url;
}

  // 处理重定向
  function handleRedirect(response, body) {
    const location = new URL(response.headers.get('location'));
    const modifiedLocation = `/${encodeURIComponent(location.toString())}`;
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
          ...response.headers,
          'Location': modifiedLocation
      }
  });
}

// 处理 HTML 内容中的相对路径
async function handleHtmlContent(response, protocol, host, originalUrl) {
  const originalText = await response.text();
  // 添加头部
  const metaTag = `<meta http-equiv="Content-Security-Policy" content="default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: gap: content: https://ssl.gstatic.com; media-src * blob: 'self' http://* 'unsafe-inline' 'unsafe-eval'; style-src * 'self' 'unsafe-inline'; img-src * 'self' data: content:; connect-src * blob:;">`;

  // 将头部添加到HTML文本中
  const updatedText = originalText.replace(/<head>/, `<head>${metaTag}`);

  const regex = /((href|src|action)=["'])(\/(?!\/))/g;

  // 使用主机地址作为前缀
  const modifiedText = updatedText.replace(regex, (match, p1) => {
      return `${p1}${protocol}//${host}/${originalUrl}`;
  });

  return modifiedText;
}

// 返回 JSON 格式的响应
  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status,
      headers: {
          'Content-Type': 'application/json; charset=utf-8'
      }
  });
}

// 过滤请求头
  function filterHeaders(headers, filterFunc) {
    return new Headers([...headers].filter(([name]) => filterFunc(name)));
}

// 设置禁用缓存的头部
  function setNoCacheHeaders(headers) {
    headers.set('Cache-Control', 'no-store');
}

// 返回根目录的 HTML
  function getRootHtml() {
    return `<!DOCTYPE html>
  <html lang="zh-CN">
  
  <head>
    <meta charset="UTF-8">
    <title>转发服务使用指南</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        background: #f4f4f4;
      }
  
      .container {
        width: 80%;
        margin: auto;
        overflow: hidden;
      }
  
      header {
        background: #333;
        color: #fff;
        padding: 20px;
        text-align: center;
      }
  
      section {
        padding: 20px;
        margin-bottom: 20px;
      }
  
      .example {
        background: #fff;
        padding: 20px;
        border-radius: 4px;
      }
  
      h2 {
        color: #333;
      }
  
      code {
        background: #ddd;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
        margin: 0 5px;
      }
    </style>
  </head>
  
  <body>
    <header>
      <h1>转发服务使用指南</h1>
    </header>
    <div class="container">
      <section>
        <h2>简介</h2>
        <p>本服务是一个轻量级的https请求转发代理，可以帮助您在开发过程中可以便捷的访问各种必要网站。该转发接口基于Cloudflare构建，以提供快速且安全的服务体验。</p>
      </section>
      <section>
        <h2>部分服务</h2>
        <p>这是我们Kcraft Network提供的服务点 您可以根据你喜欢的查看：</p>
        <ul>
          <li><strong>通用转发服务：</strong><code>https://netpr.kcraftnetwork.xyz/</code></li>
          <li><strong>kakcraft的下载站：</strong><code>https://www.kaialist.top/</code></li>
        </ul>
      </section>
      <section>
        <h2>如何使用</h2>
        <p>使用转发服务非常简单，只需遵循以下步骤：</p>
        <ol>
          <li>确定您想要访问的目标URL。</li>
          <li>根据您的需求选择相应的转发服务域名。</li>
          <li>在浏览器地址栏输入我们的转发服务URL，并在其后附加目标URL的完整路径。</li>
          <li>按下回车键，我们的服务将自动将请求转发到目标URL。</li>
        </ol>
      </section>
      <section>
        <h2>通用转发服务</h2>
        <p>对于不提供专门转发接口的网站，您可以继续使用我们的通用转发服务。</p>
        <section class="example">
          <h3>通用转发示例</h3>
          <p><strong>转发服务域名：</strong><code>https://netpr.kcraftnetwork.xyz</code></p>
          <p><strong>示例：</strong>要访问<code>https://github.com</code>，请使用以下URL：</p>
          <p><code>https://netpr.kcraftnetwork.xyz/https://github.com</code></p>
        </section>
      </section>
      <section>
        <h2>注意事项</h2>
        <p>在使用转发服务时，请仔细阅读并遵守以下条款：</p>
        <h3>遵守使用条款</h3>
        <p>您必须遵守目标网站的使用条款和条件。本服务仅作为请求转发的中介，并不对目标网站的内容或服务负责。</p>
        <h3>隐私和数据安全</h3>
        <p>保护您的个人隐私和数据安全至关重要。请不要通过本服务发送任何敏感或个人身份信息，除非您已经确认目标网站具有足够的安全措施。</p>
        <h3>版权和知识产权</h3>
        <p>您应确保在使用本服务转发内容时，不侵犯任何第三方的版权或知识产权。对于因违反版权或知识产权法律而导致的任何争议或法律责任，您应自行承担。</p>
        <h3>服务限制</h3>
        <p>本服务有可能会限制请求的数量、频率或大小。请合理使用服务，避免对服务或目标网站造成不必要的负担。</p>
        <h3>免责声明</h3>
        <p>本服务提供“按原样”的转发服务，不提供任何形式的保证。我们不对通过本服务转发的内容的准确性、可靠性或质量负责，也不对因使用本服务而可能遭受的任何损失或损害承担责任。</p>
        <h3>服务变更和中断</h3>
        <p>我们保留随时修改、更新或中断服务的权利，无需事先通知。我们不承担因服务变更或中断而造成的任何责任。</p>
        <h3>用户行为</h3>
        <p>您应确保在使用服务时遵守所有适用的法律和规定，不进行任何非法活动或恶意行为，包括但不限于网络攻击、数据爬取或任何形式的网络欺诈。</p>
      </section>
      <section>
        <h2>免责声明</h2>
        <p><strong>免责声明：</strong></p>
        <p>· 使用本转发服务时，您应自行承担风险。我们不保证服务的及时性、安全性、可用性或准确性。对于因使用或无法使用本服务而造成的任何直接、间接、特殊或后果性损害，我们不承担任何责任。</p>
        <p>· 我们不对通过本服务转发的内容承担责任，包括但不限于版权、商标或其他知识产权问题。您应确保您有权转发目标URL的内容，并且遵守所有适用的法律和规定。</p>
        <p>· 我们保留随时修改或中断服务的权利，无需事先通知。本服务不提供任何形式的保证或条件，无论是明示的还是暗示的。</p>
        <p>· 该服务不收取任何费用，使用开源代码创建，如果本服务侵犯了任何您的权利以及现有条款，我们将立刻关闭该服务。</p>
      </section>
    </div>
  </body>
  </html>`;
}
</body>
</html>`;
}
