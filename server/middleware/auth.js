import { Shopify } from "@shopify/shopify-api";
import  { DeliveryMethod } from "@shopify/shopify-api";
import topLevelAuthRedirect from "../helpers/top-level-auth-redirect.js";

export default function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    if (!req.signedCookies[app.get("top-level-oauth-cookie")]) {
      return res.redirect(
        `/auth/toplevel?${new URLSearchParams(req.query).toString()}`
      );
    }

    const redirectUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      req.query.shop,
      "/auth/callback",
      app.get("use-online-tokens")
    );

    res.redirect(redirectUrl);
  });

  app.get("/auth/toplevel", (req, res) => {
    res.cookie(app.get("top-level-oauth-cookie"), "1", {
      signed: true,
      httpOnly: true,
      sameSite: "strict",
    });

    res.set("Content-Type", "text/html");

    res.send(
      topLevelAuthRedirect({
        apiKey: Shopify.Context.API_KEY,
        hostName: Shopify.Context.HOST_NAME,
        host: req.query.host,
        query: req.query,
      })
    );
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      );

      const host = req.query.host;
      app.set(
        "active-shopify-shops",
        Object.assign(app.get("active-shopify-shops"), {
          [session.shop]: session.scope,
        })
      );
      
      const response = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "APP_UNINSTALLED",
        deliveryMethod: DeliveryMethod.PubSub,
        path: "pubsub://shopifycdp-354007:Webhooks",
      });

      if (!response["APP_UNINSTALLED"].success) {
        console.log(
          `Failed to register APP_UNINSTALLED webhook: ${response.result}`
        );
      }
      const response2 = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "PRODUCTS_CREATE",
        deliveryMethod: DeliveryMethod.PubSub,
        path: "pubsub://shopifycdp-354007:Webhooks",
      });

      if (!response2["PRODUCTS_CREATE"].success) {
        console.log(
          `Failed to register PRODUCTS_CREATE webhook: ${response2.result}`
        );
      }
      const response3 = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "PRODUCTS_UPDATE",
        deliveryMethod: DeliveryMethod.PubSub,
        path: "pubsub://shopifycdp-354007:Webhooks",
      });

      if (!response3["PRODUCTS_UPDATE"].success) {
        console.log(
          `Failed to register PRODUCTS_UPDATE webhook: ${response3.result}`
        );
      }
      
      const response4 = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "CUSTOMERS_CREATE",
        deliveryMethod: DeliveryMethod.PubSub,
        path: "pubsub://shopifycdp-354007:Webhooks",
      });

      if (!response4["CUSTOMERS_CREATE"].success) {
        console.log(
          `Failed to register CUSTOMERS_CREATE webhook: ${response4.result}`
        );
      }

      const response5 = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        topic: "ORDERS_CREATE",
        deliveryMethod: DeliveryMethod.PubSub,
        path: "pubsub://shopifycdp-354007:Webhooks",
        apiVersion: Shopify.Context.API_VERSION,
      });

      if (!response5["ORDERS_CREATE"].success) {
        console.log(
          `Failed to register ORDERS_CREATE webhook: ${response5.result}`
        );
      }
      
      

      // Redirect to app with shop parameter upon auth
      res.redirect(`/?shop=${session.shop}&host=${host}`);
    } catch (e) {
      switch (true) {
        case e instanceof Shopify.Errors.InvalidOAuthError:
          res.status(400);
          res.send(e.message);
          break;
        case e instanceof Shopify.Errors.CookieNotFound:
        case e instanceof Shopify.Errors.SessionNotFound:
          // This is likely because the OAuth session cookie expired before the merchant approved the request
          res.redirect(`/auth?shop=${req.query.shop}`);
          break;
        default:
          res.status(500);
          res.send(e.message);
          break;
      }
    }
  });
}
