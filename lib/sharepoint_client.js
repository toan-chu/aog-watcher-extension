// Minimal SharePoint REST client that reuses the browser's existing Microsoft login
// (cookies) from the extension service worker. No app registration, no tokens stored.
// fetchImpl is injectable for tests.

const JSON_LIGHT = "application/json;odata=nometadata";
const JSON_VERBOSE = "application/json;odata=verbose";

export class SharePointError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "SharePointError";
    this.status = status;
  }
}

export function normalizeSiteUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { return ""; }
  if (url.protocol !== "https:" || !/\.sharepoint\.com$/i.test(url.hostname)) return "";
  // Keep only /sites/<name> or /teams/<name> (users often paste a page or list URL).
  const match = url.pathname.match(/^\/(sites|teams)\/[^/]+/i);
  return `${url.origin}${match ? match[0] : ""}`;
}

function listPath(title) {
  return `/_api/web/lists/getbytitle('${String(title).replace(/'/g, "''")}')`;
}

export function createSharePointClient({ siteUrl, fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now() } = {}) {
  const site = normalizeSiteUrl(siteUrl);
  let digest = null;
  let digestExpires = 0;

  async function request(path, { method = "GET", body, headers = {}, verbose = false } = {}) {
    if (!site) throw new SharePointError("SharePoint site URL chưa cấu hình hoặc không hợp lệ");
    if (!fetchImpl) throw new SharePointError("fetch unavailable");
    const accept = verbose ? JSON_VERBOSE : JSON_LIGHT;
    const init = { method, credentials: "include", headers: { Accept: accept, ...headers } };
    if (body !== undefined) {
      init.headers["Content-Type"] = accept;
      init.body = JSON.stringify(body);
    }
    if (method !== "GET") init.headers["X-RequestDigest"] = await getDigest();
    let response;
    try {
      response = await fetchImpl(`${site}${path}`, init);
    } catch (error) {
      throw new SharePointError(`Không kết nối được SharePoint: ${error.message}`);
    }
    if (response.status === 401 || response.status === 403) throw new SharePointError("SharePoint từ chối quyền (chưa đăng nhập hoặc không có quyền vào site)", response.status);
    if (response.redirected && /login\.microsoftonline|\/_forms\//i.test(response.url ?? "")) throw new SharePointError("SharePoint yêu cầu đăng nhập lại", 401);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new SharePointError(`SharePoint lỗi ${response.status}: ${text.slice(0, 200)}`, response.status);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { throw new SharePointError("SharePoint trả về dữ liệu không phải JSON (có thể là trang đăng nhập)", 401); }
  }

  async function getDigest() {
    if (digest && now() < digestExpires) return digest;
    const response = await fetchImpl(`${site}/_api/contextinfo`, { method: "POST", credentials: "include", headers: { Accept: JSON_LIGHT } });
    if (!response.ok) throw new SharePointError(`Không lấy được mã bảo mật SharePoint (${response.status})`, response.status);
    const data = await response.json();
    digest = data.FormDigestValue;
    const seconds = Number(data.FormDigestTimeoutSeconds) || 1800;
    digestExpires = now() + (seconds - 60) * 1000;
    return digest;
  }

  return {
    site,
    async currentUser() {
      const data = await request("/_api/web/currentuser?$select=Title,Email,LoginName");
      return { name: data?.Title ?? "", email: data?.Email ?? "" };
    },
    async listExists(title) {
      try { await request(`${listPath(title)}?$select=Id`); return true; } catch (error) { if (error.status === 404) return false; throw error; }
    },
    async fieldNames(title) {
      const data = await request(`${listPath(title)}/fields?$select=InternalName&$filter=Hidden eq false`);
      return (data?.value ?? []).map((field) => field.InternalName);
    },
    async createList(title, description = "AOG Watcher") {
      return request("/_api/web/lists", { method: "POST", verbose: true, body: { __metadata: { type: "SP.List" }, BaseTemplate: 100, Title: title, Description: description, AllowContentTypes: true, ContentTypesEnabled: false } });
    },
    async createField(title, schemaXml) {
      return request(`${listPath(title)}/fields/CreateFieldAsXml`, { method: "POST", verbose: true, body: { parameters: { __metadata: { type: "SP.XmlSchemaFieldCreationInformation" }, SchemaXml: schemaXml, Options: 0 } } });
    },
    async items(title, { select = [], filter = "", orderby = "Id desc", top = 100 } = {}) {
      const params = [];
      if (select.length) params.push(`$select=${select.join(",")}`);
      if (filter) params.push(`$filter=${encodeURIComponent(filter)}`);
      if (orderby) params.push(`$orderby=${orderby}`);
      params.push(`$top=${top}`);
      const data = await request(`${listPath(title)}/items?${params.join("&")}`);
      return data?.value ?? [];
    },
    async addItem(title, fields) {
      return request(`${listPath(title)}/items`, { method: "POST", body: fields });
    },
    async updateItem(title, id, fields) {
      return request(`${listPath(title)}/items(${Number(id)})`, { method: "POST", body: fields, headers: { "X-HTTP-Method": "MERGE", "IF-MATCH": "*" } });
    },
  };
}

// OData string literal escaping for $filter.
export function odataString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}
