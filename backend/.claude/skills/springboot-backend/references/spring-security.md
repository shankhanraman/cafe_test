# Spring Security

Authentication and authorization for Spring Boot. Adapted from ECC's `springboot-security`,
`security-review`, and `api-design` skills, plus `dr-jskill`'s security guidance.

## Before generating: confirm requirements

Security choices are not one-size-fits-all. If the user has not already specified them in
the conversation, ask before writing config:

- Authentication mechanism: HTTP Basic (simplest), JWT (stateless APIs), or OAuth2 /
  OIDC (delegated identity).
- Stateless (token/API) vs session-based (server-rendered) — this drives CSRF and session
  configuration.
- Which endpoints are public (e.g. health, login, docs) vs protected.
- Whether roles/authorities and per-resource ownership matter.

Reuse earlier answers; only ask for what's missing.

## Explicit filter chain

Define security as an explicit `SecurityFilterChain` bean. Do not rely on defaults you
can't see.

**Example (stateless API skeleton):**
```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/api/auth/**").permitAll()
                .anyRequest().authenticated())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable())          // safe ONLY for stateless token APIs
            .httpBasic(Customizer.withDefaults()); // or .oauth2ResourceServer(...) for JWT
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

## Stateless vs session — get CSRF right

- **Stateless token/JWT APIs:** set `SessionCreationPolicy.STATELESS`. Disabling CSRF is
  acceptable here *because* there are no cookies/session to forge against — but only then.
- **Session/cookie or server-rendered apps:** keep CSRF protection **enabled**. Disabling
  CSRF on a cookie-authenticated app is a real vulnerability, not a convenience.

## Status codes

- **401 Unauthorized** — no/invalid credentials (authentication failed). Configure an
  `AuthenticationEntryPoint`.
- **403 Forbidden** — authenticated but not allowed (authorization failed). Configure an
  `AccessDeniedHandler`.
- Don't leak which usernames exist via differing error messages on login.

## Authorization

- Enforce coarse rules in the filter chain (`authorizeHttpRequests`).
- Enable method-level security (`@EnableMethodSecurity`) and use `@PreAuthorize` for
  finer rules: `@PreAuthorize("hasRole('ADMIN')")`,
  `@PreAuthorize("#ownerId == authentication.name")`.
- **Ownership:** even when not fully implemented, structure for it — e.g. carry an
  `ownerId` on resources and check it, so "only the owner can modify" is enforceable
  without a rewrite later.

## Passwords and secrets

- Never store plaintext passwords. Hash with BCrypt/Argon2 via a `PasswordEncoder`.
- Keep secrets (JWT signing keys, client secrets, DB passwords) in environment variables or
  a secrets manager — never in source or `application.properties` committed to git.
- Rotate and scope tokens; keep JWT lifetimes short and validate `iss`/`aud`/`exp`.

## CORS

- Configure CORS explicitly for browser clients on other origins; do not use a wildcard
  origin together with credentials.

## Security-review checklist

When reviewing, check for: missing input validation, broken access control (can user A
reach user B's data?), secrets in source, verbose error messages/stack traces exposed to
clients, disabled CSRF on session apps, missing authentication on sensitive endpoints,
SQL/JPQL injection via string-built queries, and outdated dependencies with known CVEs.

## Anti-patterns to avoid

- Disabling CSRF on a cookie/session-authenticated app.
- `permitAll()` left on more than the intended public endpoints.
- Returning 200 with an empty body where 401/403 is correct.
- Hardcoded credentials or signing keys.
- Rolling your own crypto or token format instead of vetted libraries.
- Putting authorization checks only in the UI/controller and not on the server.
