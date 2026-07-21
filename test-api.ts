const cookieVal = encodeURIComponent(JSON.stringify({ user: { id: "test-uuid" } }));
fetch("https://shopify-recovery-os.vercel.app/api/auth?shop=test.myshopify.com", {
  redirect: "manual",
  headers: {
    Cookie: `sb-test-auth-token=${cookieVal}`,
  },
}).then(async (r) => {
  console.log("Status:", r.status);
  console.log("Headers:");
  r.headers.forEach((v, k) => console.log(k + ": " + v));
  console.log("Body:", await r.text());
});
