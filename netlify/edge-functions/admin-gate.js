const COOKIE = "hongbon_admin_session";
const encoder = new TextEncoder();

function page(content, status = 200, extraHeaders = {}) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>HONG BON Admin</title><body style="margin:0;background:#f9f7f2;color:#342d2b;font:16px/1.6 system-ui,sans-serif"><main style="max-width:460px;margin:12vh auto;padding:32px;background:#fffdf9;border:1px solid #ded7cb"><p style="color:#a68c62;letter-spacing:.15em">HONG BON · ADMIN</p>${content}</main></body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...extraHeaders },
  });
}

async function digest(value) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function equalConstantTime(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (request) => {
  const url = new URL(request.url);
  const password = Netlify.env.get("PROTECTED_PAGE_PASSWORD");
  if (!password) {
    return page("<h1>Admin setup required</h1><p>The owner must set <code>PROTECTED_PAGE_PASSWORD</code> in Netlify and redeploy. Admin access is disabled until configured.</p>", 503);
  }

  if (url.searchParams.has("logout")) {
    return new Response(null, {
      status: 303,
      headers: {
        location: "/admin",
        "set-cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        "cache-control": "no-store",
      },
    });
  }

  const expected = await digest(password);
  const cookies = (request.headers.get("cookie") || "").split(/;\s*/);
  const current = cookies.find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
  if (equalConstantTime(current, expected)) return;

  if (request.method === "POST") {
    const form = await request.formData();
    const supplied = String(form.get("password") || "");
    if (equalConstantTime(await digest(supplied), expected)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: url.pathname,
          "set-cookie": `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
          "cache-control": "no-store",
        },
      });
    }
    return page(`<h1>Owner sign in</h1><p style="color:#992a38">Incorrect password. Try again.</p>${formMarkup}`, 401);
  }

  return page(`<h1>Owner sign in</h1><p>Enter the shared admin password configured in Netlify.</p>${formMarkup}`);
};

const formMarkup = `<form method="post"><label>Password<br><input name="password" type="password" required autofocus style="box-sizing:border-box;width:100%;padding:12px;margin:12px 0"></label><button style="background:#591e30;color:white;border:0;padding:12px 18px">Continue</button></form>`;
