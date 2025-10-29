# PatGPT

https://llm.patrickring.net/

PatGPT is a highly customized proxy layer built upon a Cloudflare Worker designed to reroute and enhance the functionality of DuckDuckGo's AI chat features (Duck.ai). This project rebrands the service, enforces specific client-side behaviors, injects custom styles, and provides robust error handling and configuration overrides.

## 🚀 Core Architecture and Proxying

The project operates as an intermediary proxy, handling all requests destined for the custom host and routing them to the target service while applying extensive transformations [1].

### Proxy Configuration
*   **Host Mapping:** Requests targeting the worker's host (`llm.patrickring.net`) are internally mapped and proxied to the official **`duckduckgo.com`** [1]. The primary `targetHost` is set to `'duckduckgo.com'` [1].
*   **Special Request Interception:**
    *   Requests involving `/cdn-cgi/rum` are immediately intercepted and returned with a 204 status response [2].
    *   Requests for standard icons (favicon, apple touch icons, etc.) are intercepted and served a hardcoded favicon from `https://www.minecraft.net/etc.clientlibs/minecraftnet/clientlibs/clientlib-site/resources/favicon.ico` [2, 3].
    *   Requests to `/duckchat/v1/status` are modified to include a dynamic timestamp query parameter (`?time=${new Date().getTime()}`) [3, 4].

### Header and Caching Management
The worker meticulously cleans, transforms, and sets various headers for improved security and performance:
*   **Header Filtering:** Sensitive headers matching `/proto|policy|x.frame.options|x.xss.protection/i` are removed from both incoming requests and outgoing responses [5, 6]. The `referer` header is also skipped if the request host relates to 'archive' [6].
*   **Host Replacement:** Host names defined in `hostMap` are substituted with the `targetHost` in request headers [6] and the reverse substitution is performed in response headers [2].
*   **User Agent:** A specific mobile user-agent string (`Mozilla/5.0 (iPhone; CPU iPhone OS 17_7_0 like Mac OS X)...`) is enforced on all proxied requests [5].
*   **Aggressive Caching:** Standard caching headers (`vary`, `etag`, `nel`, `pragma`, `cf-ray`) are deleted [5]. Specific headers like `CDN-Cache-Control` and `Cache-Control` are set [1], applying a cache lifespan of **30 seconds for requests** [6] and **33 seconds for successful responses** [7, 8].

## ✨ Customizations and Feature Overrides

### 1. Branding and Content Replacement (Server-Side)
The worker applies several string replacements in the response body if the content is text-based (text, html, script, xml, json) [9]:
*   All occurrences of the target host (`targetHostRe`) are replaced with the original host (`thisHost`) [9].
*   All occurrences of `'Duck.ai'` and `'DuckDuckGo'` are replaced with **`'PatGPT'`** [9].
*   The phrase `'Ask privately'` is replaced with **`'Ask anything'`** [9].
*   Mobile meta tags are modified: `apple-mobile-web-app-capable` content is changed from `"no"` to `"yes"` [7], and specific internal settings related to showing Apple App Store ads are set to `false` (`"showAppleAppStoreAds":false`) [7].

### 2. Custom Frontend Behavior Injection (Worker-Side Script)
The worker injects a proprietary `<script>` block into the returned HTML [10]:
*   **Auto-Redirection:** If the user lands on the root path (`/`) without search parameters (`location.search===''`), they are immediately redirected to the **AI Chat query page** (`/?q=DuckDuckGo+AI+Chat&ia=chat&duckai=1`) [11, 12].
*   **Interface Overrides (DOM):** Prototype methods for DOM insertion (`append`, `appendChild`, etc.) are modified to set a `text` attribute on appended elements based on their string content [10, 11].
*   **Button Utility:** An event listener is added to inserted buttons, removing the **`disabled` attribute on mouseover** [11].
*   **Persistent Configuration (`localStorage`):** Several critical settings are forced via `localStorage` [12, 13]:
    *   Terms are auto-agreed (`duckaiHasAgreedToTerms: 'true'`) [12].
    *   The assistant name is set to **"PatGPT"** within `duckaiCustomization` [12].
    *   The preferred AI model is configured (`preferredDuckaiModel: '203'`) [12].
    *   AI chat promotions are programmatically dismissed with the current date [12].
    *   Approximate location usage is enabled (`duckaiCanUseApproxLocation: 'true'`) [13].
    *   Prompt suggestions are hidden (`aiChatPromptSuggestions: '{"hideSuggestions":true}'`) [13].
    *   A `setInterval` runs every 100ms to click a specific button (likely an alert or dark/light mode toggle) if found [13].
*   **External Script Injection:** An external script, `fetch.js`, is fetched and injected into the HTML [13].

### 3. Visual Customizations (CSS Injection)
A dedicated `<style>` block is injected to modify the appearance and hide unwanted elements [14]:
*   **UI Hiding:** Numerous elements related to help pages, settings, specific UI sections, app store links (`apps.apple.com`, `play.google.com`), the "4o-mini" button, and various feedback/privacy elements are hidden using `display:none !important` [14-16].
*   **Text Styling:** Headings (`h1`-`h6`), strong tags, and the first letter of list items and paragraphs are styled using `text-transform:capitalize` [16].
*   **Global Filter:** A **`filter:hue-rotate(-45deg)`** is applied to the entire HTML document [16].

### 4. Client-Side API Manipulation (`fetch.js` - Injected Script)
The external `fetch.js` script overrides core browser APIs for advanced runtime control [4]:
*   **Global `fetch` Override:** The global `fetch` function is wrapped [4].
    *   **Tracking Prevention:** Requests to specific service domains (`improving.llm.patrickring.net`, `quack.llm.patrickring.net`, `privacy-pro-eligible.json`) are intercepted and provided an empty successful JSON response (`{}`) [17].
    *   **LLM Model Enforcement:** All `/duckchat/v1/chat` requests are intercepted. The request body is modified to **force the LLM model to `'gpt-5-mini'`** and ensure `WebSearch` is set to `true` in the metadata [17, 18].
*   **Token Management:** The `'x-vqd-hash-1'` token is extracted from successful responses and stored in `sessionMap` (session storage/Map) for later use [18, 19].
*   **Robust Error Spoofing:** If a chat request fails (non-200 status code [18] or throws an error [19]), the override constructs a synthetic successful `text/event-stream` response. This response includes the error message (or status text) formatted as a message from the assistant, using the stored `'x-vqd-hash-1'` token [19, 20].
*   **Image Source Correction:** The setter for `HTMLImageElement.prototype.src` is modified to fix a specific hostname typo, replacing `'external-content.llm.patrickring.net'` with `'external-content-llm.patrickring.net'` [21].
*   **Tracking Shutdown:** The `navigator.sendBeacon` function is overridden to immediately return `true`, effectively **disabling client-side reporting** [22].

## 🛣️ Future Development

*   **Request/Response Caching:** Integration of a **vector database for request/response caching** is intended to drastically reduce latency and reliance on the upstream service for redundant queries.
