export interface paths {
  '/api/v2/account': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/account */
    get: operations['get__api_v2_account'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/devices': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/account/devices */
    get: operations['get__api_v2_account_devices'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/entitlements': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/account/entitlements */
    get: operations['get__api_v2_account_entitlements'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/licenses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/account/licenses */
    get: operations['get__api_v2_account_licenses'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/orders': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/account/orders */
    get: operations['get__api_v2_account_orders'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/security': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/account/security */
    get: operations['get__api_v2_account_security'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/security/mobile': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/account/security/mobile */
    post: operations['post__api_v2_account_security_mobile'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/security/otp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/account/security/otp */
    post: operations['post__api_v2_account_security_otp'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/account/security/password': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/account/security/password */
    post: operations['post__api_v2_account_security_password'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/activation-codes': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/activation-codes */
    get: operations['get__api_v2_admin_activation_codes'];
    put?: never;
    /** POST /api/v2/admin/activation-codes */
    post: operations['post__api_v2_admin_activation_codes'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/activation-codes/{id}/cancel': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/activation-codes/{id}/cancel */
    post: operations['post__api_v2_admin_activation_codes__id__cancel'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/audit': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/audit */
    get: operations['get__api_v2_admin_audit'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/auth/login */
    post: operations['post__api_v2_admin_auth_login'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/auth/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/auth/logout */
    post: operations['post__api_v2_admin_auth_logout'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/auth/session': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/auth/session */
    get: operations['get__api_v2_admin_auth_session'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/auth/sms/verify': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/auth/sms/verify */
    post: operations['post__api_v2_admin_auth_sms_verify'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/commerce/{section}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/commerce/{section} */
    get: operations['get__api_v2_admin_commerce__section_'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/commerce/campaigns': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/commerce/campaigns */
    post: operations['post__api_v2_admin_commerce_campaigns'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/commerce/campaigns/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** PATCH /api/v2/admin/commerce/campaigns/{id} */
    patch: operations['patch__api_v2_admin_commerce_campaigns__id_'];
    trace?: never;
  };
  '/api/v2/admin/commerce/coupons': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/commerce/coupons */
    post: operations['post__api_v2_admin_commerce_coupons'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/commerce/coupons/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** PATCH /api/v2/admin/commerce/coupons/{id} */
    patch: operations['patch__api_v2_admin_commerce_coupons__id_'];
    trace?: never;
  };
  '/api/v2/admin/commerce/orders/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/commerce/orders/{id} */
    get: operations['get__api_v2_admin_commerce_orders__id_'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/commerce/orders/{id}/reconcile': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/commerce/orders/{id}/reconcile */
    post: operations['post__api_v2_admin_commerce_orders__id__reconcile'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/commerce/refunds/{id}/review': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/commerce/refunds/{id}/review */
    post: operations['post__api_v2_admin_commerce_refunds__id__review'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/customers': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/customers */
    get: operations['get__api_v2_admin_customers'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/customers/{id}/password-reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/customers/{id}/password-reset */
    post: operations['post__api_v2_admin_customers__id__password_reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/customers/{id}/reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/customers/{id}/reset */
    post: operations['post__api_v2_admin_customers__id__reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/devices': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/devices */
    get: operations['get__api_v2_admin_devices'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/devices/{id}/products/{sku}/block': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/devices/{id}/products/{sku}/block */
    post: operations['post__api_v2_admin_devices__id__products__sku__block'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/devices/{id}/products/{sku}/unblock': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/devices/{id}/products/{sku}/unblock */
    post: operations['post__api_v2_admin_devices__id__products__sku__unblock'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/licenses': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/licenses */
    get: operations['get__api_v2_admin_licenses'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/licenses/{id}/reissue': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/licenses/{id}/reissue */
    post: operations['post__api_v2_admin_licenses__id__reissue'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/licenses/{id}/revoke': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/licenses/{id}/revoke */
    post: operations['post__api_v2_admin_licenses__id__revoke'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/licenses/issue': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/licenses/issue */
    post: operations['post__api_v2_admin_licenses_issue'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/notes/{type}/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/notes/{type}/{id} */
    post: operations['post__api_v2_admin_notes__type___id_'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/payment-readiness': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/payment-readiness */
    get: operations['get__api_v2_admin_payment_readiness'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/products': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/products */
    get: operations['get__api_v2_admin_products'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/products/{sku}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** PATCH /api/v2/admin/products/{sku} */
    patch: operations['patch__api_v2_admin_products__sku_'];
    trace?: never;
  };
  '/api/v2/admin/products/{sku}/promotions': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/products/{sku}/promotions */
    get: operations['get__api_v2_admin_products__sku__promotions'];
    put?: never;
    /** POST /api/v2/admin/products/{sku}/promotions */
    post: operations['post__api_v2_admin_products__sku__promotions'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/promotions/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    /** PATCH /api/v2/admin/promotions/{id} */
    patch: operations['patch__api_v2_admin_promotions__id_'];
    trace?: never;
  };
  '/api/v2/admin/promotions/{id}/deactivate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/promotions/{id}/deactivate */
    post: operations['post__api_v2_admin_promotions__id__deactivate'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/promotions/{id}/restore': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/promotions/{id}/restore */
    post: operations['post__api_v2_admin_promotions__id__restore'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/reports': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/reports */
    get: operations['get__api_v2_admin_reports'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/trials': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/admin/trials */
    get: operations['get__api_v2_admin_trials'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/admin/trials/{id}/{sku}/reset': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/admin/trials/{id}/{sku}/reset */
    post: operations['post__api_v2_admin_trials__id___sku__reset'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/challenge': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/challenge */
    post: operations['post__api_v2_auth_challenge'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/claim': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * POST /api/v2/auth/claim
     * @description Browser authorization returns a public receipt only. No device credential, signed enrollment or desktop claim grant is returned. Fresh pairing-bound device-key proof is mandatory at the separate desktop pickup endpoint. Legacy register/desktop-confirm endpoints are retired (410). Commercial startup remains closed.
     */
    post: operations['post__api_v2_auth_claim'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/claim/otp/request': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/claim/otp/request */
    post: operations['post__api_v2_auth_claim_otp_request'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/login': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/login */
    post: operations['post__api_v2_auth_login'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/logout': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/logout */
    post: operations['post__api_v2_auth_logout'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/otp/request': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/otp/request */
    post: operations['post__api_v2_auth_otp_request'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/otp/verify': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/otp/verify */
    post: operations['post__api_v2_auth_otp_verify'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/password-reset/complete': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/password-reset/complete */
    post: operations['post__api_v2_auth_password_reset_complete'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/password-reset/otp': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/password-reset/otp */
    post: operations['post__api_v2_auth_password_reset_otp'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/auth/session/rotate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/auth/session/rotate */
    post: operations['post__api_v2_auth_session_rotate'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/commerce/capabilities': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/commerce/capabilities */
    get: operations['get__api_v2_commerce_capabilities'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/desktop/activation-codes/redeem': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/desktop/activation-codes/redeem */
    post: operations['post__api_v2_desktop_activation_codes_redeem'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/desktop/entitlements': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/desktop/entitlements */
    get: operations['get__api_v2_desktop_entitlements'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/desktop/licenses/pickup': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/desktop/licenses/pickup */
    post: operations['post__api_v2_desktop_licenses_pickup'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/desktop/licenses/sync': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/desktop/licenses/sync */
    post: operations['post__api_v2_desktop_licenses_sync'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/desktop/trials/{sku}/start': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * POST /api/v2/desktop/trials/{sku}/start
     * @description Exactly two starts per machine, grade, account generation and authorized allocation epoch. Identical current-epoch retries return the stored result. A nonce retired by Admin trial reset returns HTTP 409 TRIAL_ALLOCATION_CHANGED without consuming the new quota. Already-started processes continue offline indefinitely.
     */
    post: operations['post__api_v2_desktop_trials__sku__start'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/desktop/trials/{sku}/status': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/desktop/trials/{sku}/status */
    get: operations['get__api_v2_desktop_trials__sku__status'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/device-pairings': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/device-pairings */
    post: operations['post__api_v2_device_pairings'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/device-pairings/{id}/cancel': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/device-pairings/{id}/cancel */
    post: operations['post__api_v2_device_pairings__id__cancel'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/device-pairings/{id}/confirm': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/device-pairings/{id}/confirm */
    post: operations['post__api_v2_device_pairings__id__confirm'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/device-pairings/{id}/desktop-confirm': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * POST /api/v2/device-pairings/{id}/desktop-confirm
     * @deprecated
     * @description Retired Phase 2 development protocol. Always returns 410 PROTOCOL_RETIRED; cannot issue credentials or enroll a profile.
     */
    post: operations['post__api_v2_device_pairings__id__desktop_confirm'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/device-pairings/{id}/pickup': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/device-pairings/{id}/pickup */
    post: operations['post__api_v2_device_pairings__id__pickup'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/device-pairings/{id}/preview': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/device-pairings/{id}/preview */
    post: operations['post__api_v2_device_pairings__id__preview'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/devices/authenticate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/devices/authenticate */
    post: operations['post__api_v2_devices_authenticate'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/devices/challenges': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/devices/challenges */
    post: operations['post__api_v2_devices_challenges'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/devices/register': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /**
     * POST /api/v2/devices/register
     * @deprecated
     * @description Retired Phase 2 development protocol. Always returns 410 PROTOCOL_RETIRED; cannot issue credentials or enroll a profile.
     */
    post: operations['post__api_v2_devices_register'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/discounts/quote': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/discounts/quote */
    post: operations['post__api_v2_discounts_quote'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/orders': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/orders */
    get: operations['get__api_v2_orders'];
    put?: never;
    /** POST /api/v2/orders */
    post: operations['post__api_v2_orders'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/orders/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/orders/{id} */
    get: operations['get__api_v2_orders__id_'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/orders/{id}/payments': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/orders/{id}/payments */
    post: operations['post__api_v2_orders__id__payments'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/orders/{id}/refund-request': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/orders/{id}/refund-request */
    post: operations['post__api_v2_orders__id__refund_request'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/orders/{id}/simulate': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** POST /api/v2/orders/{id}/simulate */
    post: operations['post__api_v2_orders__id__simulate'];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/payments/zarinpal/return': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/payments/zarinpal/return */
    get: operations['get__api_v2_payments_zarinpal_return'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/products': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/products */
    get: operations['get__api_v2_products'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v2/products/{sku}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /api/v2/products/{sku} */
    get: operations['get__api_v2_products__sku_'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/health': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /health */
    get: operations['get__health'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/ready': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** GET /ready */
    get: operations['get__ready'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    Error: {
      error: {
        code: string;
        request_id: string;
      };
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  get__api_v2_account: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            username: string;
            device_id: string;
            generation: number;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_account_devices: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            status: string;
            /** Format: date-time */
            created_at: string;
          }[];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_account_entitlements: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            sku: string;
            state: string;
            /** Format: date-time */
            created_at: string;
          }[];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_account_licenses: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            sku: string;
            state: string;
            decision_version: string;
          }[];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_account_orders: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_account_security: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            has_password: boolean;
            mobile_masked: string | null;
            mobile_verified: boolean;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_account_security_mobile: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          challenge_id: string;
          code: string;
          current?: {
            challenge_id: string;
            code: string;
          };
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            changed: true;
            /** @constant */
            reauthentication_required: true;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_account_security_otp: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @enum {string} */
          purpose: 'PASSWORD' | 'MOBILE_OLD' | 'MOBILE_NEW';
          mobile?: string;
          current?: {
            challenge_id: string;
            code: string;
          };
          current_password?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            challenge_id: string;
            /** @constant */
            expires_in: 180;
            /** @constant */
            retry_after: 60;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_account_security_password: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          challenge_id: string;
          code: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            changed: true;
            /** @constant */
            reauthentication_required: true;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_activation_codes: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          device_id: string;
          sku: string;
          /** Format: date-time */
          expires_at: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_activation_codes: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          device_id: string;
          sku: string;
          /** Format: date-time */
          expires_at: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_activation_codes__id__cancel: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_audit: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          }[];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_auth_login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            challenge_id: string;
            /** @constant */
            expires_in: 180;
            /** @constant */
            retry_after: 60;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_auth_logout: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_auth_session: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            permissions: string[];
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_auth_sms_verify: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          challenge_id: string;
          code: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            csrf_token: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_commerce__section_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        section:
          | 'orders'
          | 'payments'
          | 'campaigns'
          | 'coupons'
          | 'jobs'
          | 'exceptions'
          | 'reservations'
          | 'redemptions'
          | 'finance'
          | 'refunds';
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            [key: string]: unknown;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_commerce_campaigns: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          name: string;
          /** Format: date-time */
          starts_at: string;
          /** Format: date-time */
          ends_at: string;
          enabled: boolean;
          max_redemptions: number | null;
          max_per_customer: number | null;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  patch__api_v2_admin_commerce_campaigns__id_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          name: string;
          /** Format: date-time */
          starts_at: string;
          /** Format: date-time */
          ends_at: string;
          enabled: boolean;
          max_redemptions: number | null;
          max_per_customer: number | null;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_commerce_coupons: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          campaign_id: string;
          code: string;
          /** @enum {string} */
          type: 'percent' | 'fixed';
          value: number;
          max_discount_irr: number | null;
          min_order_irr: number | null;
          enabled: boolean;
          max_redemptions: number | null;
          max_per_customer: number | null;
          skus: string[];
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  patch__api_v2_admin_commerce_coupons__id_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          campaign_id: string;
          code: string;
          /** @enum {string} */
          type: 'percent' | 'fixed';
          value: number;
          max_discount_irr: number | null;
          min_order_irr: number | null;
          enabled: boolean;
          max_redemptions: number | null;
          max_per_customer: number | null;
          skus: string[];
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_commerce_orders__id_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            customer_id: string;
            device_id: string;
            generation: number;
            sku: string;
            state: string;
            /** @constant */
            currency: 'IRR';
            /** Format: date-time */
            created_at: string;
            paid_at: string | null;
            /** Format: date-time */
            expires_at: string;
            exception_code: string | null;
            license_id: string | null;
            snapshot: {
              title_fa: string;
              username: string;
            } & {
              [key: string]: unknown;
            };
            subtotal_irr: number;
            discount_irr: number;
            promotion_id: string | null;
            promotion_discount_irr: number;
            coupon_discount_irr: number;
            total_irr: number;
            revision: number;
            /** @constant */
            mode: 'simulated';
            payments: {
              id: string;
              state: string;
              /** Format: date-time */
              created_at: string;
              verified_at: string | null;
              provider_ref: string | null;
              exception_code: string | null;
              redirect_url: string | null;
              customer_return: ('OK' | 'NOK') | null;
              provider_status: ('VERIFIED' | 'PAID' | 'IN_BANK' | 'FAILED' | 'REVERSED') | null;
              terminal_reason: string | null;
            }[];
            transitions: {
              [key: string]: unknown;
            }[];
            reconciliation: {
              [key: string]: unknown;
            }[];
            inquiries: {
              [key: string]: unknown;
            }[];
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_commerce_orders__id__reconcile: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_commerce_refunds__id__review: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          /** @enum {string} */
          state: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_customers: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_customers__id__password_reset: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json':
            | {
                reset_grant: string;
              }
            | {
                /** @constant */
                secret_already_delivered: true;
              };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_customers__id__reset: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_devices: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_devices__id__products__sku__block: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_devices__id__products__sku__unblock: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_licenses: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_licenses__id__reissue: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_licenses__id__revoke: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_licenses_issue: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          device_id: string;
          sku: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_notes__type___id_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        type:
          | 'customers'
          | 'devices'
          | 'licenses'
          | 'activation-codes'
          | 'trials'
          | 'products'
          | 'orders'
          | 'payments'
          | 'campaigns'
          | 'coupons';
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          note: string;
          expected_revision: number;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            note: string;
            revision: number;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_payment_readiness: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            real_payments_possible: false;
            /** Format: date-time */
            generated_at: string;
            production_payment_gate: {
              /** @constant */
              id: 'ZARINPAL_LIVE_GATE_CLOSED';
              /** @constant */
              open: false;
            };
            gates: {
              id: string;
              reason: string;
              open: boolean;
            }[];
            runtime: {
              /** @enum {string} */
              node_env: 'development' | 'test' | 'production';
              /** @enum {string} */
              commerce_mode: 'disabled' | 'fake' | 'zarinpal_sandbox' | 'zarinpal';
              sandbox: boolean;
            };
            merchant_configuration: {
              merchant_id_present: boolean;
              callback_url_present: boolean;
              /** @constant */
              live_merchant_usable: false;
            };
            sandbox_evidence: {
              verified_payments: number;
              unresolved_payments: number;
              last_verified_at: string | null;
            };
            health: {
              unknown_payments: number;
              open_exceptions: number;
              jobs_in_review: number;
              overdue_jobs: number;
              paid_unfulfilled: number;
              oldest_unresolved_seconds: number | null;
            };
            catalog: {
              sku: string;
              publication_status: string;
              sale_enabled: boolean;
              price_irr: string | null;
            }[];
            evidence: {
              id: string;
              /** @enum {string} */
              status: 'verified' | 'owner_confirmed' | 'partial' | 'blocked' | 'not_started';
              evidence: string;
              reference: string;
            }[];
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_products: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  patch__api_v2_admin_products__sku_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          price_irr: number;
          /** @enum {string} */
          publication_status: 'published' | 'coming_soon' | 'hidden';
          sale_enabled: boolean;
          trial_enabled: boolean;
          activation_enabled: boolean;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_products__sku__promotions: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          promo_price_irr: number;
          /** Format: date-time */
          starts_at?: string;
          /** Format: date-time */
          ends_at: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json':
            | {
                id: string;
                sku: string;
                original_price_irr: number;
                promo_price_irr: number;
                discount_percent: number;
                /** Format: date-time */
                starts_at: string;
                /** Format: date-time */
                ends_at: string;
                /** @enum {string} */
                state: 'ENABLED' | 'DISABLED';
                /** @enum {string} */
                status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
                revision: number;
                reason: string;
                updated_by: string;
                /** Format: date-time */
                updated_at: string;
              }
            | {
                promotions: {
                  id: string;
                  sku: string;
                  original_price_irr: number;
                  promo_price_irr: number;
                  discount_percent: number;
                  /** Format: date-time */
                  starts_at: string;
                  /** Format: date-time */
                  ends_at: string;
                  /** @enum {string} */
                  state: 'ENABLED' | 'DISABLED';
                  /** @enum {string} */
                  status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
                  revision: number;
                  reason: string;
                  updated_by: string;
                  /** Format: date-time */
                  updated_at: string;
                }[];
                history: {
                  [key: string]: unknown;
                }[];
              };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_products__sku__promotions: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          promo_price_irr: number;
          /** Format: date-time */
          starts_at?: string;
          /** Format: date-time */
          ends_at: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json':
            | {
                id: string;
                sku: string;
                original_price_irr: number;
                promo_price_irr: number;
                discount_percent: number;
                /** Format: date-time */
                starts_at: string;
                /** Format: date-time */
                ends_at: string;
                /** @enum {string} */
                state: 'ENABLED' | 'DISABLED';
                /** @enum {string} */
                status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
                revision: number;
                reason: string;
                updated_by: string;
                /** Format: date-time */
                updated_at: string;
              }
            | {
                promotions: {
                  id: string;
                  sku: string;
                  original_price_irr: number;
                  promo_price_irr: number;
                  discount_percent: number;
                  /** Format: date-time */
                  starts_at: string;
                  /** Format: date-time */
                  ends_at: string;
                  /** @enum {string} */
                  state: 'ENABLED' | 'DISABLED';
                  /** @enum {string} */
                  status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
                  revision: number;
                  reason: string;
                  updated_by: string;
                  /** Format: date-time */
                  updated_at: string;
                }[];
                history: {
                  [key: string]: unknown;
                }[];
              };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  patch__api_v2_admin_promotions__id_: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
          promo_price_irr?: number;
          /** Format: date-time */
          starts_at?: string;
          /** Format: date-time */
          ends_at?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            sku: string;
            original_price_irr: number;
            promo_price_irr: number;
            discount_percent: number;
            /** Format: date-time */
            starts_at: string;
            /** Format: date-time */
            ends_at: string;
            /** @enum {string} */
            state: 'ENABLED' | 'DISABLED';
            /** @enum {string} */
            status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
            revision: number;
            reason: string;
            updated_by: string;
            /** Format: date-time */
            updated_at: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_promotions__id__deactivate: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            sku: string;
            original_price_irr: number;
            promo_price_irr: number;
            discount_percent: number;
            /** Format: date-time */
            starts_at: string;
            /** Format: date-time */
            ends_at: string;
            /** @enum {string} */
            state: 'ENABLED' | 'DISABLED';
            /** @enum {string} */
            status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
            revision: number;
            reason: string;
            updated_by: string;
            /** Format: date-time */
            updated_at: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_promotions__id__restore: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            sku: string;
            original_price_irr: number;
            promo_price_irr: number;
            discount_percent: number;
            /** Format: date-time */
            starts_at: string;
            /** Format: date-time */
            ends_at: string;
            /** @enum {string} */
            state: 'ENABLED' | 'DISABLED';
            /** @enum {string} */
            status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'DISABLED';
            revision: number;
            reason: string;
            updated_by: string;
            /** Format: date-time */
            updated_at: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_reports: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_admin_trials: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_admin_trials__id___sku__reset: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
          reason: string;
          expected_revision: number;
          evidence_ref?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_challenge: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @enum {string} */
          purpose: 'LOGIN' | 'RESET' | 'CLAIM';
          mobile: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            challenge: string;
            bits: number;
            expires_in: number;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_claim: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          pairing_id: string;
          pairing_secret: string;
          password?: string;
          otp?: {
            challenge_id: string;
            code: string;
          };
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'APPROVED';
            /** @constant */
            authenticated: true;
            csrf_token?: string;
            username: string;
            /** Format: date-time */
            expires_at: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_claim_otp_request: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          pairing_id: string;
          pairing_secret: string;
          mobile: string;
          pow?: {
            challenge: string;
            counter: string;
          };
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            challenge_id: string;
            /** @constant */
            expires_in: 180;
            /** @constant */
            retry_after: 60;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_logout: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_otp_request: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          username: string;
          mobile: string;
          /** @enum {string} */
          purpose: 'LOGIN' | 'RESET';
          pow?: {
            challenge: string;
            counter: string;
          };
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            challenge_id: string;
            /** @constant */
            expires_in: 180;
            /** @constant */
            retry_after: 60;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_otp_verify: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          challenge_id: string;
          code: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            csrf_token: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_password_reset_complete: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          reset_grant: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_password_reset_otp: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          challenge_id: string;
          code: string;
          password: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            password_changed: true;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_auth_session_rotate: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_commerce_capabilities: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @enum {string} */
            mode: 'disabled' | 'fake' | 'zarinpal_sandbox' | 'zarinpal';
            checkout_enabled: boolean;
            /** @constant */
            real_payments_enabled: false;
            sandbox: boolean;
            test_price_irr: number | null;
            /** @constant */
            currency: 'IRR';
            enabled_capabilities: (
              | 'PRODUCTION_CORE'
              | 'CUSTOMER_AUTH'
              | 'ADMIN_AUTH'
              | 'DESKTOP_PROVISIONING'
              | 'TRIALS_AND_LICENSES'
              | 'LIVE_COMMERCE'
            )[];
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_desktop_activation_codes_redeem: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          activation_code: string;
          device_id: string;
          sku: string;
          request_id: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            algorithm: 'ES256-P1363';
            payload: {
              device_id: string;
              /** @constant */
              device_fingerprint_version: 2;
              device_fingerprint_digest: string;
              license_id: string;
              customer_id: string;
              sku: string;
              grade: number;
              expires_at: null;
              license_revision: number;
              /** @constant */
              format: 'YARIZAN-LICENSE-V2';
              kid: string;
              /** Format: date-time */
              issued_at: string;
            };
            signature: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_desktop_entitlements: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_desktop_licenses_pickup: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          sku: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            algorithm: 'ES256-P1363';
            payload: {
              device_id: string;
              /** @constant */
              device_fingerprint_version: 2;
              device_fingerprint_digest: string;
              license_id: string;
              customer_id: string;
              sku: string;
              grade: number;
              expires_at: null;
              license_revision: number;
              /** @constant */
              format: 'YARIZAN-LICENSE-V2';
              kid: string;
              /** Format: date-time */
              issued_at: string;
            };
            signature: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_desktop_licenses_sync: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          license_id: string;
          sku: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            algorithm: 'ES256-P1363';
            payload: {
              device_id: string;
              /** @constant */
              device_fingerprint_version: 2;
              device_fingerprint_digest: string;
              license_id: string;
              sku: string;
              decision_version: number;
              /** @enum {string} */
              status: 'ACTIVE' | 'REVOKED';
              /** @constant */
              format: 'YARIZAN-LICENSE-DECISION-V2';
              kid: string;
              /** Format: date-time */
              issued_at: string;
            };
            signature: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_desktop_trials__sku__start: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sku: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          device_id: string;
          client_nonce: string;
          client_process_session_id: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            grant: {
              /** @constant */
              algorithm: 'ES256-P1363';
              payload: {
                device_id: string;
                sku: string;
                grade: number;
                client_nonce: string;
                process_session_id: string;
                /** @constant */
                format: 'YARIZAN-TRIAL-START-V2';
                kid: string;
                /** Format: date-time */
                issued_at: string;
              };
              signature: string;
            };
            remaining: number;
            /** Format: date-time */
            server_time: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_desktop_trials__sku__status: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sku: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            remaining: number;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_device_pairings: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @constant */
          fingerprint_version: 2;
          fingerprint_digest: string;
          device_public_key: string;
          challenge_id: string;
          challenge_signature: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_device_pairings__id__cancel: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          pairing_secret: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'CANCELLED';
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_device_pairings__id__confirm: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          pairing_secret: string;
          password?: string;
          otp?: {
            challenge_id: string;
            code: string;
          };
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            /** @constant */
            status: 'APPROVED';
            /** @constant */
            authenticated: true;
            csrf_token?: string;
            username: string;
            /** Format: date-time */
            expires_at: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_device_pairings__id__desktop_confirm: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_device_pairings__id__pickup: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @constant */
          fingerprint_version: 2;
          fingerprint_digest: string;
          device_public_key: string;
          challenge_id: string;
          challenge_signature: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json':
            | {
                /** @constant */
                status: 'PENDING';
              }
            | {
                /** @constant */
                status: 'ENROLLED';
                device_id: string;
                customer_id: string;
                username: string;
                enrollment: {
                  /** @constant */
                  algorithm: 'ES256-P1363';
                  payload: {
                    device_id: string;
                    /** @constant */
                    device_fingerprint_version: 2;
                    device_fingerprint_digest: string;
                    device_key_digest: string;
                    profile_enrollment_id: string;
                    /** @constant */
                    format: 'YARIZAN-DEVICE-ENROLLMENT-V2';
                    kid: string;
                    /** Format: date-time */
                    issued_at: string;
                  };
                  signature: string;
                };
                credential: string;
              };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_device_pairings__id__preview: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          pairing_secret: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            username: string;
            requires_owner: boolean;
            /** @constant */
            status: 'PENDING';
            /** Format: date-time */
            expires_at: string;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_devices_authenticate: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @constant */
          fingerprint_version: 2;
          fingerprint_digest: string;
          device_public_key: string;
          challenge_id: string;
          challenge_signature: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_devices_challenges: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @constant */
          fingerprint_version: 2;
          fingerprint_digest: string;
          device_public_key: string;
          /** @enum {string} */
          purpose: 'PAIR' | 'AUTH' | 'CONFIRM';
          pairing_id?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_devices_register: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_discounts_quote: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          sku: string;
          coupon?: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            sku: string;
            title_fa: string;
            /** @constant */
            currency: 'IRR';
            subtotal_irr: number;
            discount_irr: number;
            promotion_discount_irr: number;
            coupon_discount_irr: number;
            total_irr: number;
            test_price: boolean;
            promotion: {
              id: string;
              price_irr: number;
              discount_percent: number;
              /** Format: date-time */
              ends_at: string;
            } | null;
            /** @constant */
            mode: 'simulated';
            pricing_revision: number;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_orders: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          sku: string;
          coupon?: string;
          request_id: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            items: {
              [key: string]: unknown;
            }[];
            next_offset: number | null;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_orders: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          sku: string;
          coupon?: string;
          request_id: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            customer_id: string;
            device_id: string;
            generation: number;
            sku: string;
            state: string;
            /** @constant */
            currency: 'IRR';
            /** Format: date-time */
            created_at: string;
            paid_at: string | null;
            /** Format: date-time */
            expires_at: string;
            exception_code: string | null;
            license_id: string | null;
            snapshot: {
              title_fa: string;
              username: string;
            } & {
              [key: string]: unknown;
            };
            subtotal_irr: number;
            discount_irr: number;
            promotion_id: string | null;
            promotion_discount_irr: number;
            coupon_discount_irr: number;
            total_irr: number;
            revision: number;
            /** @constant */
            mode: 'simulated';
            payments: {
              id: string;
              state: string;
              /** Format: date-time */
              created_at: string;
              verified_at: string | null;
              provider_ref: string | null;
              exception_code: string | null;
              redirect_url: string | null;
              customer_return: ('OK' | 'NOK') | null;
              provider_status: ('VERIFIED' | 'PAID' | 'IN_BANK' | 'FAILED' | 'REVERSED') | null;
              terminal_reason: string | null;
            }[];
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_orders__id_: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            id: string;
            customer_id: string;
            device_id: string;
            generation: number;
            sku: string;
            state: string;
            /** @constant */
            currency: 'IRR';
            /** Format: date-time */
            created_at: string;
            paid_at: string | null;
            /** Format: date-time */
            expires_at: string;
            exception_code: string | null;
            license_id: string | null;
            snapshot: {
              title_fa: string;
              username: string;
            } & {
              [key: string]: unknown;
            };
            subtotal_irr: number;
            discount_irr: number;
            promotion_id: string | null;
            promotion_discount_irr: number;
            coupon_discount_irr: number;
            total_irr: number;
            revision: number;
            /** @constant */
            mode: 'simulated';
            payments: {
              id: string;
              state: string;
              /** Format: date-time */
              created_at: string;
              verified_at: string | null;
              provider_ref: string | null;
              exception_code: string | null;
              redirect_url: string | null;
              customer_return: ('OK' | 'NOK') | null;
              provider_status: ('VERIFIED' | 'PAID' | 'IN_BANK' | 'FAILED' | 'REVERSED') | null;
              terminal_reason: string | null;
            }[];
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_orders__id__payments: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          request_id: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            attempt_id: string;
            state: string;
            redirect_url: string | null;
            /** @constant */
            mode: 'simulated';
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_orders__id__refund_request: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          reason: string;
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  post__api_v2_orders__id__simulate: {
    parameters: {
      query?: never;
      header: {
        'X-CSRF-Token': string;
      };
      path: {
        id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        'application/json': {
          /** @enum {string} */
          outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'UNKNOWN';
        };
      };
    };
    responses: {
      /** @description Successful operation */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            order_id: string;
            /** @constant */
            status: 'VERIFICATION_PENDING';
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_payments_zarinpal_return: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            order_id: string;
            /** @constant */
            status: 'VERIFICATION_PENDING';
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_products: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            sku: string;
            grade: number;
            title_fa: string;
            /** @enum {string} */
            publication_status: 'published' | 'coming_soon' | 'hidden';
            sale_enabled: boolean;
            trial_enabled: boolean;
            activation_enabled: boolean;
            revision: number;
            price_irr: number;
          }[];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__api_v2_products__sku_: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        sku: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': {
            sku: string;
            grade: number;
            title_fa: string;
            /** @enum {string} */
            publication_status: 'published' | 'coming_soon' | 'hidden';
            sale_enabled: boolean;
            trial_enabled: boolean;
            activation_enabled: boolean;
            revision: number;
            price_irr: number;
          };
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__health: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
  get__ready: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Successful operation */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': Record<string, never>;
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      410: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
      /** @description Structured error; no secrets or request bodies echoed */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['Error'];
        };
      };
    };
  };
}
