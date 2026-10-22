const crypto = require("crypto");

const config = () => ({
    bucket: process.env.S3_BUCKET,
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    endpoint: process.env.S3_ENDPOINT
});

const isConfigured = () => {
    const values = config();
    return Boolean(values.bucket && values.region && values.accessKeyId && values.secretAccessKey);
};

const encodePath = (value) => value.split("/").map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
const encodeQuery = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
const hmac = (key, value, encoding) => crypto.createHmac("sha256", key).update(value).digest(encoding);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const timestamp = () => new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");

const targetFor = (key) => {
    const values = config();
    if (values.endpoint) {
        const endpoint = new URL(values.endpoint);
        const basePath = endpoint.pathname.replace(/\/$/, "");
        return { url: new URL(`${basePath}/${encodePath(values.bucket)}/${encodePath(key)}`, endpoint.origin), host: endpoint.host };
    }
    return {
        url: new URL(`https://s3.${values.region}.amazonaws.com/${encodePath(values.bucket)}/${encodePath(key)}`),
        host: `s3.${values.region}.amazonaws.com`
    };
};

const signingKey = (secret, date, region) => {
    const dateKey = hmac(`AWS4${secret}`, date);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, "s3");
    return hmac(serviceKey, "aws4_request");
};

const signedRequest = async (method, key, body, contentType) => {
    const values = config();
    const { url, host } = targetFor(key);
    const dateTime = timestamp();
    const date = dateTime.slice(0, 8);
    const payloadHash = sha256(body || Buffer.alloc(0));
    const headers = {
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": dateTime
    };
    if (contentType) headers["content-type"] = contentType;
    if (values.sessionToken) headers["x-amz-security-token"] = values.sessionToken;
    const headerNames = [...Object.keys(headers), "host"].sort();
    const signedHeaders = headerNames.join(";");
    const canonicalHeaders = headerNames.map((name) => `${name}:${String(name === "host" ? host : headers[name]).trim()}\n`).join("");
    const canonicalRequest = [method, url.pathname, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const scope = `${date}/${values.region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", dateTime, scope, sha256(canonicalRequest)].join("\n");
    const signature = hmac(signingKey(values.secretAccessKey, date, values.region), stringToSign, "hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${values.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const response = await fetch(url, { method, headers, body: method === "PUT" ? body : undefined });
    if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`S3 respondió ${response.status}${detail ? `: ${detail}` : ""}`);
    }
};

const getSignedUrl = (key, expiresSeconds = 300) => {
    const values = config();
    const { url, host } = targetFor(key);
    const dateTime = timestamp();
    const date = dateTime.slice(0, 8);
    const scope = `${date}/${values.region}/s3/aws4_request`;
    const params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": `${values.accessKeyId}/${scope}`,
        "X-Amz-Date": dateTime,
        "X-Amz-Expires": String(expiresSeconds),
        "X-Amz-SignedHeaders": "host"
    };
    if (values.sessionToken) params["X-Amz-Security-Token"] = values.sessionToken;
    const canonicalQuery = Object.keys(params).sort().map((name) => `${encodeQuery(name)}=${encodeQuery(params[name])}`).join("&");
    const canonicalRequest = ["GET", url.pathname, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", dateTime, scope, sha256(canonicalRequest)].join("\n");
    const signature = hmac(signingKey(values.secretAccessKey, date, values.region), stringToSign, "hex");
    url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return url.toString();
};

module.exports = {
    isConfigured,
    putObject: (key, body, contentType) => signedRequest("PUT", key, body, contentType),
    deleteObject: (key) => signedRequest("DELETE", key),
    getSignedUrl
};
