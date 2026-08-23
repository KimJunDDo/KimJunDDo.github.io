---
title: "Spring SecurityとJWTでログインを実装する"
date: 2026-08-23
draft: false
description: "セッション、Cookie、JWT認証の違いを整理し、MyGomiバックエンドにSpring SecurityとJWTログインを実装した流れを解説します。"
tags: ["Spring Boot", "Spring Security", "JWT", "Authentication"]
categories: ["Spring Boot"]
showTableOfContents: true
---

MyGomiのバックエンドには、メールアドレスとパスワードでログインしたユーザーへJWTを発行し、その後のリクエストでは`Authorization`ヘッダーを使ってユーザーを認証する機能を実装した。

JWTのコードを書く前に、まず整理すべき概念があった。「Cookieログイン、セッションログイン、JWTログイン」を互いに置き換え可能な三つの方式として説明することがあるが、**Cookieは情報を保存・伝達する手段であり、セッションとJWTは認証状態を表現する方法**である。そもそも比較する基準が少し異なる。

{{< conclusion >}}
**MyGomiはサーバーセッションを作らないstateless認証を使用する。** ログインに成功すると、サーバーはユーザーのメールアドレスと権限を含むアクセストークンを発行する。クライアントはその後の各リクエストで`Authorization: Bearer {token}`ヘッダーを送信する。
{{< /conclusion >}}

この記事では、セッション、Cookie、JWTの関係を整理した後、MyGomiプロジェクトにおける実際のログインフローと今後改善すべき点を確認する。

## 認証と認可を区別する

ログイン機能を理解するには、認証と認可を区別する必要がある。

- **認証（Authentication）**は、ユーザーが誰であるかを確認する処理である。メールアドレスとパスワードを検証するログインが代表的だ。
- **認可（Authorization）**は、認証済みユーザーが特定の機能を利用する権限を持つか判断する処理である。一般ユーザーと管理者向けAPIを分ける処理が代表的だ。

MyGomiでは、Spring Securityがメールアドレスとパスワードを検証してJWTを発行するまでが認証に当たる。JWTの`auth` claimに保存されたroleを使い、管理者APIへのアクセス可否を判断する処理が認可に当たる。

## Cookie、セッション、JWTの違い

### Cookieは保存と伝達の手段

Cookieは、ブラウザが特定のドメインと関連付けて保存する小さなデータである。サーバーがレスポンスの`Set-Cookie`ヘッダーでCookieを設定すると、ブラウザは条件に合う次のリクエストへそのCookieを自動的に含める。

Cookie自体がログイン方式なのではない。CookieにはセッションIDを入れることも、JWTを入れることもできる。そのため「CookieとJWTのどちらを使うか」という質問は、正確には次の二つに分ける必要がある。

1. 認証状態をサーバーセッションで管理するか、情報を内包するトークンで管理するかを決める。
2. 発行した識別子またはトークンをCookieに保存するか、別のストレージに保存してヘッダーへ入れるかを決める。

### セッションログイン

セッション方式では、ログインに成功したユーザーの認証状態をサーバーへ保存する。サーバーはそのデータを検索するためのセッションIDを作り、通常はブラウザのCookieへ`JSESSIONID`のような値として渡す。

その後のリクエストは次のように処理される。

1. ブラウザがセッションIDを含むCookieを自動送信する。
2. サーバーがセッションストアから該当IDを検索する。
3. 検索したユーザーと権限に基づいてリクエストを処理する。

セッションの利点は、サーバーが認証状態を直接制御できることにある。ログアウトや強制失効が必要なら、サーバー側でセッションを削除できる。一方でサーバーが状態を保持するため、複数サーバーを運用する場合はセッション共有、sticky session、または専用のセッションストアが必要になる。

### JWTログイン

JWT方式では、ログインに成功するとサーバーがユーザー識別情報、権限、有効期限などを含むトークンへ署名する。クライアントはこのトークンを保存し、リクエストごとに送信する。サーバーはログインセッションを検索する代わりに、署名と有効期限を検証する。

JWTはドット（`.`）で区切られた三つの部分から構成される。

```text
header.payload.signature
```

- Headerにはトークン種別と署名アルゴリズムが入る。
- Payloadにはユーザー情報や権限などのclaimが入る。
- Signatureは、トークンがサーバーから発行された後に改ざんされていないかを確認するために使う。

重要なのは、**JWTのpayloadは暗号化された領域ではない**という点である。Base64 URL形式でエンコードされているだけなので、誰でも内容を確認できる。パスワード、個人番号、秘密鍵などの機密情報をJWTに入れてはならない。

### 一覧で比較する

| 区分 | セッション認証 | JWT認証 |
| --- | --- | --- |
| 認証状態の中心 | サーバーのセッションストア | クライアントが持つ署名済みトークン |
| リクエスト時の値 | 主にCookie内のセッションID | 主にBearerトークンまたはCookie |
| サーバー側の検索 | 通常はセッション検索が必要 | 基本的な検証ではセッション検索が不要 |
| 強制ログアウト | セッション削除で比較的容易 | blocklistやトークン戦略が必要 |
| サーバーのスケール | セッション共有戦略が必要 | 複数サーバーで同じ署名鍵を使って検証可能 |
| 主な注意点 | セッションストアとCSRF | 盗難、有効期限、失効、鍵管理 |

JWTが常にセッションより優れているわけではない。サーバーが認証状態を即座に失効させる必要がある場合や、構造が単純なWebアプリケーションではセッションの方が自然なこともある。複数のAPIサーバー、モバイルクライアント、WebSocket接続で同じ認証情報を渡すMyGomiでは、JWTが使いやすいと判断した。

## MyGomiのJWTログインフロー

プロジェクトのログイン処理は、大きくトークン発行とトークン検証に分けられる。

### 1. 会員登録時にパスワードをハッシュ化する

`SecurityConfig`には`BCryptPasswordEncoder`をBeanとして登録した。会員登録リクエストのパスワードはそのまま保存せず、BCryptで一方向ハッシュへ変換してからユーザー情報を保存する。

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}
```

```java
User user = User.builder()
        .email(request.getEmail())
        .password(passwordEncoder.encode(request.getPassword()))
        .nickname(request.getNickname())
        .role(Role.USER)
        .build();

userRepository.save(user);
```

ログイン時も、保存済みパスワードを復号しない。Spring Securityの`PasswordEncoder`が、入力されたパスワードと保存されたBCryptハッシュが一致するかを検証する。

BCryptは、同じパスワードでも毎回異なるsaltを使用するため結果が変わる適応型一方向関数である。本番環境ではデフォルト値を無条件に使うのではなく、サーバー上でパスワード検証時間を測定し、ユーザー体験とサーバー負荷を考慮してwork factorを調整する必要がある。

### 2. メールアドレスとパスワードを認証する

クライアントは`POST /api/auth/login`へメールアドレスとパスワードを送信する。

```json
{
  "email": "user@example.com",
  "password": "password123!"
}
```

`AuthService`はリクエストデータを`UsernamePasswordAuthenticationToken`へ変換し、`AuthenticationManager`へ渡す。

```java
UsernamePasswordAuthenticationToken authenticationToken =
        new UsernamePasswordAuthenticationToken(
                request.getEmail(),
                request.getPassword()
        );

Authentication authentication = authenticationManagerBuilder
        .getObject()
        .authenticate(authenticationToken);
```

名前にTokenが入っているが、このオブジェクトはまだJWTではない。ユーザーが送信したIDとパスワードをSpring Securityの認証処理へ渡すためのオブジェクトである。

`CustomUserDetailsService`はメールアドレスでユーザーを検索し、Spring Securityが扱える`UserDetails`へ変換する。

```java
return org.springframework.security.core.userdetails.User.builder()
        .username(user.getEmail())
        .password(user.getPassword())
        .roles(user.getRole().name())
        .build();
```

ユーザーが存在しない、またはパスワードが一致しない場合は認証に失敗する。成功すると、メールアドレスと`ROLE_USER`または`ROLE_ADMIN`のような権限を持つ`Authentication`オブジェクトが返される。

### 3. アクセストークンを生成する

認証に成功すると、`JwtTokenProvider`が`Authentication`からメールアドレスと権限を取り出してJWTを生成する。

```java
return Jwts.builder()
        .subject(authentication.getName())
        .claim("auth", authorities)
        .issuedAt(new Date())
        .expiration(validity)
        .signWith(key)
        .compact();
```

現在のトークンには次の情報が入る。

| claim | 内容 |
| --- | --- |
| `sub` | ログインしたユーザーのメールアドレス |
| `auth` | ユーザーの権限一覧 |
| `iat` | トークン発行時刻 |
| `exp` | トークン有効期限 |

プロジェクト設定上、アクセストークンの有効期間は24時間である。ログインレスポンスでは、アクセストークンとユーザーIDを返す。

```json
{
  "data": {
    "accessToken": "eyJ...",
    "userId": 1
  },
  "meta": {
    "timestamp": "2026-08-23T12:00:00"
  }
}
```

現在の実装にはRefresh Tokenがない。アクセストークンの期限が切れると、ユーザーは再度ログインする必要がある。

### 4. リクエストヘッダーからJWTを取得する

ログイン後、クライアントはAPIを呼び出すときに次のヘッダーを送る。

```http
Authorization: Bearer eyJ...
```

`JwtAuthenticationFilter`は、すべてのHTTPリクエストで`Authorization`ヘッダーを確認し、`Bearer `の後ろにある文字列を取得する。

```java
private String resolveToken(HttpServletRequest request) {
    String bearerToken = request.getHeader("Authorization");

    if (StringUtils.hasText(bearerToken)
            && bearerToken.startsWith("Bearer ")) {
        return bearerToken.substring(7);
    }

    return null;
}
```

フィルターはトークンの署名と有効期限を検証する。有効なトークンなら、payloadの`sub`と`auth`を使って`Authentication`を再構成し、`SecurityContextHolder`へ保存する。

```java
if (token != null && jwtTokenProvider.validateToken(token)) {
    Authentication authentication =
            jwtTokenProvider.getAuthentication(token);

    SecurityContext context =
            SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
}
```

空の`SecurityContext`を新しく作って設定することで、既存コンテキストの変更時に起こり得る競合状態を避けられる。リクエスト終了時にはフィルターチェーンがコンテキストをクリアするため、次のリクエストではトークンを再検証する。

この処理が終わると、コントローラーは`@AuthenticationPrincipal`で現在のユーザーを受け取れる。

```java
@GetMapping("/me")
public ResponseEntity<UserResponseDto> getCurrentUser(
        @AuthenticationPrincipal UserDetails userDetails) {
    String email = userDetails.getUsername();
    return ResponseEntity.ok(userService.getCurrentUser(email));
}
```

### 5. セッションを作らないように設定する

JWT認証を使いながらサーバーセッションも生成すると、stateless構成の利点が薄れる。MyGomiはSpring Securityのセッションポリシーを`STATELESS`に設定した。

```java
http
        .formLogin(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        )
        .addFilterBefore(
                new JwtAuthenticationFilter(jwtTokenProvider),
                UsernamePasswordAuthenticationFilter.class
        );
```

サーバーはログイン状態を`HttpSession`へ保存しない。各リクエストは、自身が持つJWTだけで認証される必要がある。

ここで`STATELESS`とCSRF設定を同じ概念として扱ってはならない。`STATELESS`は、Spring Securityがセッションから`SecurityContext`を取得したり保存したりしないためのポリシーである。トークンを`Authorization`ヘッダーだけで受け取り、ブラウザが認証情報を自動送信しないREST APIなら、CSRFを無効化する構成を検討できる。一方、JWTやRefresh TokenをCookieへ入れる場合はブラウザがCookieを自動送信するため、CSRF対策を維持する必要がある。

### 6. STOMP WebSocket接続でも同じトークンを使う

MyGomiのチャットはSTOMPを使う。通常のHTTPヘッダーを検査する`JwtAuthenticationFilter`だけではSTOMPメッセージの認証を処理できないため、別途`ChannelInterceptor`を用意した。

クライアントが`CONNECT`するとき、native headerへBearerトークンを入れると、`StompHandler`が検証して接続ユーザーとして登録する。

```java
if (StompCommand.CONNECT.equals(accessor.getCommand())) {
    String rawToken = accessor.getFirstNativeHeader("Authorization");

    if (rawToken != null && rawToken.startsWith("Bearer ")) {
        String token = rawToken.substring(7);

        if (jwtTokenProvider.validateToken(token)) {
            Authentication authentication =
                    jwtTokenProvider.getAuthentication(token);
            accessor.setUser(authentication);
        }
    }
}
```

チャットルームを購読するときは、接続ユーザーのメールアドレスでDBからユーザーを検索し、そのユーザーが購入者または販売者であることも確認する。一つのJWT認証情報をREST APIとWebSocketで共有した部分である。

`CONNECT`でユーザーを認証するだけでは、すべてのメッセージが安全になるわけではない。クライアントが任意のbroker destinationへメッセージを送信したり、他のユーザーのqueueを購読したりできないよう、`MESSAGE`と`SUBSCRIBE`も個別に認可する必要がある。Spring Securityの`AuthorizationManager<Message<?>>`を利用すると、destination単位のルールを宣言できる。

```java
@Bean
AuthorizationManager<Message<?>> messageAuthorizationManager(
        MessageMatcherDelegatingAuthorizationManager.Builder messages) {

    messages
            .simpDestMatchers("/app/chat/**").authenticated()
            .simpSubscribeDestMatchers("/user/**").authenticated()
            .simpMessageDestMatchers("/topic/**", "/queue/**").denyAll()
            .anyMessage().denyAll();

    return messages.build();
}
```

実際のdestination構造に合わせ、許可範囲を具体的に記述する必要がある。特にメッセージ本文の送信者IDは信用せず、認証済み`Principal`を基準にサーバーが送信者を決定する。

## SecurityConfigで確認したアクセス制御

認証情報を`SecurityContext`へ保存することと、APIアクセスを拒否することは別の問題である。現在の`SecurityConfig`は、管理者向け通報APIだけに`ADMIN` roleを要求し、それ以外のリクエストを許可している。

```java
.authorizeHttpRequests(auth -> auth
        .requestMatchers(
                "/api/reports/admin",
                "/api/reports/admin/**"
        ).hasRole("ADMIN")
        .anyRequest().permitAll()
)
```

したがって、現在の構成を「すべてのAPIへJWT認証を適用した」と表現するのは正確ではない。`/api/users/me`のようにコントローラーが`@AuthenticationPrincipal`を直接確認するAPIはトークンなしで呼び出すと失敗するが、フィルターチェーンの段階ですべての保護対象APIを一貫して遮断している状態ではない。

会員登録、ログイン、Swaggerなどの公開パスだけを`permitAll()`にし、ユーザーAPIには`authenticated()`を適用する構成の方が明確である。

```java
.authorizeHttpRequests(auth -> auth
        .requestMatchers(
                "/api/auth/signup",
                "/api/auth/login",
                "/swagger-ui/**",
                "/v3/api-docs/**"
        ).permitAll()
        .requestMatchers("/api/reports/admin/**").hasRole("ADMIN")
        .anyRequest().authenticated()
)
```

実際に公開するAPIがほかにもあるなら、運用ポリシーに合わせて明示的に追加する。重要なのは、トークンを解釈する認証ロジックと、URLごとのアクセス権限を決める認可ポリシーを一緒に完成させることだ。

## トークンはどこに保存するべきか

現在のフロントエンドAPIドキュメントでは、アクセストークンを`localStorage`へ保存し、リクエストごとに`Authorization`ヘッダーへ入れる例を使用している。

```typescript
const token = localStorage.getItem('accessToken');

const response = await fetch('/api/users/me', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

実装が簡単で、モバイルアプリやAPIクライアントでも同じ規則を利用できる利点がある。しかし、ページ上で実行されたJavaScriptがトークンへアクセスできるため、XSS攻撃が起きるとトークンを盗まれる可能性がある。

ブラウザ向けサービスでは次の代替案も検討できる。

- アクセストークンはメモリだけに保持し、有効期間を短くする。
- Refresh Tokenは`HttpOnly`、`Secure`、`SameSite`属性を設定したCookieで管理する。
- すべてのユーザー入力を安全に処理し、CSPを適用してXSSリスクを下げる。

JWTをCookieへ入れるとJavaScriptからの直接アクセスを防げるが、ブラウザがCookieを自動送信するため、CSRF対策を改めて検討する必要がある。Authorizationヘッダーでトークンを送る構成とCookieベースの構成では、同じセキュリティ設定をそのまま使えない。

## 現在の実装で改善すべき点

今回の実装で基本的なログインとトークン検証フローは完成したが、本番環境を考えると次の項目を改善する必要がある。

### 秘密鍵を環境変数へ分離する

JWT署名鍵がリポジトリの設定ファイルに直接入っていると、コードへアクセスできる人が有効なトークンを偽造できる。すでに公開された鍵は環境変数へ移すだけでは不十分で、必ず新しい鍵へローテーションする必要がある。

```properties
jwt.secret=${JWT_SECRET}
jwt.expiration=${JWT_EXPIRATION:86400000}
```

本番環境では十分に長いランダムな鍵をSecret Managerやデプロイ環境のsecretとして管理する。ログにも元のトークンや秘密鍵を残さない。

### Access TokenとRefresh Tokenを分離する

24時間有効なアクセストークンは、盗まれた場合に攻撃者も同じ時間だけ利用できる。アクセストークンの有効期間を短くし、より長期間有効なRefresh Tokenで再発行する構成を検討できる。

この場合、Refresh Tokenの保存、rotation、再利用検知、ログアウト時の失効ポリシーまで一緒に設計する必要がある。Refresh Tokenを追加するだけで、自動的に安全になるわけではない。

### ログアウトと強制失効のポリシーを決める

現在のJWTはサーバーが個別の状態を保持しないため、クライアントがトークンを削除しても、すでにコピーされたトークンは有効期限まで利用できる。パスワード変更、アカウント停止、強制ログアウトを即座に反映するには、次のような戦略が必要になる。

- アクセストークンの有効期限を短くする。
- Refresh Tokenをサーバー側で失効させる。
- 必要な場合だけトークンblocklistを運用する。
- ユーザーごとのトークンバージョンを持ち、以前のバージョンを拒否する。

サービスのリスクと運用の複雑さを考慮し、必要なレベルを選択する。

### 認証失敗レスポンスを統一する

トークンが存在しない、または不正な場合は`401 Unauthorized`、認証済みでも権限が足りない場合は`403 Forbidden`を一貫して返す。`AuthenticationEntryPoint`と`AccessDeniedHandler`を適用すると、クライアントがログイン期限切れと権限不足を区別しやすくなる。

### 認証フローをテストで固定する

ログイン成功だけを確認しても、セキュリティ設定の回帰は防ぎにくい。最低限、次のシナリオを統合テストとして維持するとよい。

- 公開APIはトークンなしで呼び出せる。
- 保護対象APIはトークンがない、または不正な場合に`401`を返す。
- 一般ユーザーが管理者APIを呼び出すと`403`を返す。
- 期限切れまたは署名が改ざんされたトークンを拒否する。
- パスワードと元のJWTをログへ出力しない。
- 許可していないSTOMP destinationの`MESSAGE`と`SUBSCRIBE`を拒否する。

## 実装を通して整理したこと

JWTログインは、単に文字列トークンを一つ作る機能ではなかった。次の要素が一つの流れとして接続される必要がある。

1. BCryptでパスワードを安全に保存する。
2. Spring Securityでメールアドレスとパスワードを認証する。
3. ユーザー、権限、有効期限を含むJWTへ署名する。
4. クライアントがリクエストごとにBearerトークンを送信する。
5. フィルターがトークンを検証して`SecurityContext`を構成する。
6. URLとroleに合う認可ルールを適用する。
7. 有効期限、再発行、ログアウト、秘密鍵の運用ポリシーを決める。
8. HTTPとSTOMPの認可ルールを統合テストで検証する。

{{< conclusion >}}
**結論:** Cookieは認証情報を運ぶ手段であり、セッションとJWTは認証状態を管理する異なる方法である。MyGomiはSpring SecurityとJWTでstatelessログインの基盤を作り、REST APIとSTOMP接続で同じ認証情報を利用した。次の段階では、保護対象APIの認可ルールを明確にし、秘密鍵、トークン保存、再発行、失効ポリシーを本番環境に合わせて改善する必要がある。
{{< /conclusion >}}

## 参考資料

- [Spring Security Reference - Session Management](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html)
- [Spring Security Reference - Password Storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
- [Spring Security Reference - Authorize HttpServletRequests](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)
- [Spring Security Reference - WebSocket Security](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html)
- [RFC 7519 - JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [OWASP - JSON Web Token Cheat Sheet for Java](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [OWASP - HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
