---
title: "Spring Security와 JWT로 로그인 구현하기"
date: 2026-08-23
draft: false
description: "세션, 쿠키, JWT 인증의 차이를 정리하고 MyGomi 백엔드에 Spring Security와 JWT 로그인을 구현한 과정을 살펴봅니다."
tags: ["Spring Boot", "Spring Security", "JWT", "Authentication"]
categories: ["Spring Boot"]
showTableOfContents: true
---

MyGomi 백엔드에는 이메일과 비밀번호로 로그인한 사용자에게 JWT를 발급하고, 이후 요청의 `Authorization` 헤더로 사용자를 인증하는 기능을 구현했다.

JWT 코드를 작성하기 전에 먼저 정리해야 할 개념이 있었다. 흔히 "쿠키 로그인, 세션 로그인, JWT 로그인"을 서로 대체하는 세 가지 방식처럼 말하지만, **쿠키는 정보를 전달하고 보관하는 수단이고 세션과 JWT는 인증 상태를 표현하는 방법**이다. 서로 비교하는 기준부터 조금 다르다.

{{< conclusion >}}
**MyGomi는 서버 세션을 만들지 않는 stateless 인증을 사용한다.** 로그인에 성공하면 서버가 사용자의 이메일과 권한을 담은 액세스 토큰을 발급하고, 클라이언트는 이후 요청마다 `Authorization: Bearer {token}` 헤더를 전송한다.
{{< /conclusion >}}

이 글에서는 세션, 쿠키, JWT의 관계를 먼저 정리한 뒤 MyGomi 프로젝트의 실제 로그인 흐름과 앞으로 보완할 부분을 살펴본다.

## 인증과 인가부터 구분하기

로그인 기능을 이해하려면 인증과 인가를 구분해야 한다.

- **인증(Authentication)**은 사용자가 누구인지 확인하는 과정이다. 이메일과 비밀번호를 검사하는 로그인이 대표적이다.
- **인가(Authorization)**는 인증된 사용자가 특정 기능을 사용할 권한이 있는지 판단하는 과정이다. 일반 사용자와 관리자 API를 구분하는 것이 대표적이다.

MyGomi에서는 Spring Security가 이메일과 비밀번호를 검증하고 JWT를 발급하는 과정이 인증에 해당한다. JWT의 `auth` claim에 저장된 역할로 관리자 API 접근을 판단하는 과정은 인가에 해당한다.

## 쿠키, 세션, JWT는 무엇이 다른가?

### 쿠키는 저장과 전달 수단이다

쿠키는 브라우저가 특정 도메인에 연결해 보관하는 작은 데이터다. 서버가 응답의 `Set-Cookie` 헤더로 쿠키를 설정하면 브라우저는 조건에 맞는 다음 요청에 해당 쿠키를 자동으로 포함한다.

쿠키 자체가 로그인 방식인 것은 아니다. 쿠키 안에는 세션 ID를 넣을 수도 있고 JWT를 넣을 수도 있다. 따라서 "쿠키와 JWT 중 무엇을 사용할까?"라는 질문은 정확히는 다음 두 문제로 나누어야 한다.

1. 인증 상태를 서버 세션으로 관리할지, 자체 정보를 가진 토큰으로 관리할지 결정한다.
2. 발급한 식별자 또는 토큰을 쿠키에 보관할지, 다른 저장소에 보관한 뒤 헤더에 넣을지 결정한다.

### 세션 로그인

세션 방식에서는 로그인에 성공한 사용자의 인증 상태를 서버에 저장한다. 서버는 이 데이터를 찾을 수 있는 세션 ID를 만들고, 보통 브라우저의 쿠키에 `JSESSIONID`와 같은 값으로 전달한다.

이후 요청은 다음과 같이 처리된다.

1. 브라우저가 세션 ID가 담긴 쿠키를 자동으로 전송한다.
2. 서버가 세션 저장소에서 해당 ID를 조회한다.
3. 조회한 사용자와 권한을 바탕으로 요청을 처리한다.

세션의 장점은 서버가 인증 상태를 직접 통제한다는 것이다. 로그아웃이나 강제 만료가 필요하면 서버에서 세션을 제거할 수 있다. 반면 서버가 상태를 보관하므로 여러 서버를 운영할 때는 세션 공유, 고정 세션 또는 별도의 세션 저장소가 필요하다.

### JWT 로그인

JWT 방식에서는 로그인에 성공하면 서버가 사용자 식별 정보, 권한, 만료 시간 등을 담은 토큰에 서명한다. 클라이언트는 이 토큰을 보관했다가 요청마다 전송한다. 서버는 별도의 로그인 세션을 조회하는 대신 서명과 만료 시간을 검증한다.

JWT는 점(`.`)으로 구분된 세 부분으로 구성된다.

```text
header.payload.signature
```

- Header에는 토큰 종류와 서명 알고리즘이 들어간다.
- Payload에는 사용자 정보와 권한 같은 claim이 들어간다.
- Signature는 토큰이 서버가 발급한 뒤 변조되지 않았는지 확인하는 데 사용한다.

중요한 점은 **JWT의 payload는 암호화된 공간이 아니라는 것**이다. Base64 URL 형식으로 인코딩되어 있어 누구나 내용을 확인할 수 있다. 비밀번호, 주민등록번호, 비밀키와 같은 민감 정보는 JWT에 넣으면 안 된다.

### 한눈에 비교하기

| 구분 | 세션 인증 | JWT 인증 |
| --- | --- | --- |
| 인증 상태의 중심 | 서버의 세션 저장소 | 클라이언트가 가진 서명 토큰 |
| 요청 시 전달 값 | 주로 쿠키의 세션 ID | 주로 Bearer 토큰 또는 쿠키 |
| 서버 측 조회 | 일반적으로 세션 조회 필요 | 기본 검증에는 세션 조회 불필요 |
| 강제 로그아웃 | 세션 삭제로 비교적 간단 | 별도 차단 목록이나 토큰 전략 필요 |
| 서버 확장 | 세션 공유 전략 필요 | 여러 서버에서 같은 서명키로 검증 가능 |
| 주요 주의점 | 세션 저장소와 CSRF | 탈취, 만료, 폐기와 키 관리 |

JWT가 언제나 세션보다 좋은 것은 아니다. 서버가 인증 상태를 즉시 폐기해야 하거나 구조가 단순한 웹 애플리케이션이라면 세션이 더 자연스러울 수 있다. 여러 API 서버, 모바일 클라이언트, WebSocket 연결에서 동일한 인증 정보를 전달하려는 MyGomi에는 JWT가 편리하다고 판단했다.

## MyGomi의 JWT 로그인 흐름

프로젝트의 로그인 과정은 크게 토큰 발급과 토큰 검증으로 나뉜다.

### 1. 회원가입 시 비밀번호 암호화

`SecurityConfig`에는 `BCryptPasswordEncoder`를 Bean으로 등록했다. 회원가입 요청의 비밀번호는 그대로 저장하지 않고 BCrypt로 단방향 해시한 뒤 사용자 정보를 저장한다.

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

로그인할 때도 저장된 비밀번호를 복호화하지 않는다. Spring Security의 `PasswordEncoder`가 입력받은 비밀번호와 저장된 BCrypt 해시가 일치하는지 검사한다.

BCrypt는 같은 비밀번호도 매번 다른 salt를 사용해 결과가 달라지는 적응형 단방향 함수다. 운영 환경에서는 기본값을 그대로 믿기보다 서버에서 비밀번호 검증에 걸리는 시간을 측정하고, 사용자 경험과 서버 부하를 고려해 work factor를 조정해야 한다.

### 2. 이메일과 비밀번호 인증

클라이언트는 `POST /api/auth/login`으로 이메일과 비밀번호를 전송한다.

```json
{
  "email": "user@example.com",
  "password": "password123!"
}
```

`AuthService`는 요청 데이터를 `UsernamePasswordAuthenticationToken`으로 만들고 `AuthenticationManager`에 전달한다.

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

이름에 Token이 들어가지만 이 객체는 아직 JWT가 아니다. 사용자가 제출한 아이디와 비밀번호를 Spring Security의 인증 과정에 전달하는 용도다.

`CustomUserDetailsService`는 이메일로 사용자를 조회하고 Spring Security가 이해할 수 있는 `UserDetails`로 변환한다.

```java
return org.springframework.security.core.userdetails.User.builder()
        .username(user.getEmail())
        .password(user.getPassword())
        .roles(user.getRole().name())
        .build();
```

사용자가 없거나 비밀번호가 일치하지 않으면 인증이 실패한다. 성공하면 이메일과 `ROLE_USER` 또는 `ROLE_ADMIN` 같은 권한을 가진 `Authentication` 객체가 반환된다.

### 3. 액세스 토큰 생성

인증에 성공하면 `JwtTokenProvider`가 `Authentication`으로부터 이메일과 권한을 꺼내 JWT를 만든다.

```java
return Jwts.builder()
        .subject(authentication.getName())
        .claim("auth", authorities)
        .issuedAt(new Date())
        .expiration(validity)
        .signWith(key)
        .compact();
```

현재 토큰에는 다음 정보가 들어간다.

| claim | 내용 |
| --- | --- |
| `sub` | 로그인한 사용자의 이메일 |
| `auth` | 사용자의 권한 목록 |
| `iat` | 토큰 발급 시각 |
| `exp` | 토큰 만료 시각 |

프로젝트 설정상 액세스 토큰의 유효 시간은 24시간이다. 로그인 응답에는 액세스 토큰과 사용자 ID가 함께 반환된다.

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

현재 구현에는 Refresh Token이 없다. 액세스 토큰이 만료되면 사용자는 다시 로그인해야 한다.

### 4. 요청 헤더에서 JWT 추출

로그인 이후 클라이언트는 API를 호출할 때 다음 헤더를 보낸다.

```http
Authorization: Bearer eyJ...
```

`JwtAuthenticationFilter`는 모든 HTTP 요청에서 `Authorization` 헤더를 확인하고 `Bearer ` 다음의 문자열을 추출한다.

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

필터는 토큰의 서명과 만료 시간을 검증한다. 유효한 토큰이면 payload의 `sub`와 `auth`를 사용해 `Authentication`을 다시 만들고 `SecurityContextHolder`에 저장한다.

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

빈 `SecurityContext`를 새로 만들어 설정하면 기존 컨텍스트를 수정하면서 발생할 수 있는 경쟁 상태를 피할 수 있다. 요청이 끝날 때 필터 체인이 컨텍스트를 정리하므로 다음 요청에서는 토큰을 다시 검증한다.

이 작업이 끝나면 컨트롤러는 `@AuthenticationPrincipal`로 현재 사용자를 받을 수 있다.

```java
@GetMapping("/me")
public ResponseEntity<UserResponseDto> getCurrentUser(
        @AuthenticationPrincipal UserDetails userDetails) {
    String email = userDetails.getUsername();
    return ResponseEntity.ok(userService.getCurrentUser(email));
}
```

### 5. 세션을 만들지 않도록 설정

JWT 인증을 사용하면서 서버 세션이 함께 생성되면 stateless 구조의 장점이 흐려진다. MyGomi는 Spring Security의 세션 정책을 `STATELESS`로 설정했다.

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

서버는 로그인 상태를 `HttpSession`에 보관하지 않는다. 각 요청은 자신이 가진 JWT만으로 인증되어야 한다.

여기서 `STATELESS`와 CSRF 설정을 같은 개념으로 보면 안 된다. `STATELESS`는 Spring Security가 세션에서 `SecurityContext`를 가져오거나 저장하지 않도록 하는 정책이다. 토큰을 오직 `Authorization` 헤더로 받고 브라우저가 인증 정보를 자동 전송하지 않는 REST API라면 CSRF를 비활성화하는 구성을 검토할 수 있다. 반대로 JWT나 Refresh Token을 쿠키에 넣는다면 브라우저가 쿠키를 자동 전송하므로 CSRF 방어를 유지해야 한다.

### 6. STOMP WebSocket 연결에서도 같은 토큰 사용

MyGomi의 채팅은 STOMP를 사용한다. 일반 HTTP 헤더를 검사하는 `JwtAuthenticationFilter`만으로는 STOMP 메시지의 인증을 처리할 수 없기 때문에 `ChannelInterceptor`를 별도로 두었다.

클라이언트가 `CONNECT`할 때 네이티브 헤더에 Bearer 토큰을 보내면 `StompHandler`가 이를 검증하고 연결 사용자로 등록한다.

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

채팅방을 구독할 때는 연결된 사용자 이메일로 DB의 사용자를 조회한 뒤, 해당 사용자가 구매자 또는 판매자인지도 확인한다. 하나의 JWT 인증 정보를 REST API와 WebSocket에서 함께 활용한 부분이다.

`CONNECT`에서 사용자를 인증하는 것만으로 모든 메시지가 안전해지는 것은 아니다. 클라이언트가 임의의 broker destination으로 메시지를 보내거나 다른 사용자의 queue를 구독하지 못하도록 `MESSAGE`와 `SUBSCRIBE`도 별도로 인가해야 한다. Spring Security의 `AuthorizationManager<Message<?>>`를 사용하면 destination별 규칙을 선언할 수 있다.

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

실제 destination 구조에 맞춰 허용 범위를 구체적으로 작성해야 한다. 특히 메시지 본문의 발신자 ID는 신뢰하지 않고, 인증된 `Principal`을 기준으로 서버가 발신자를 결정해야 한다.

## SecurityConfig에서 확인한 접근 제어

인증 정보를 `SecurityContext`에 저장하는 것과 API 접근을 막는 것은 별개의 문제다. 현재 `SecurityConfig`는 관리자 신고 API에만 `ADMIN` 역할을 요구하고 나머지 요청은 허용한다.

```java
.authorizeHttpRequests(auth -> auth
        .requestMatchers(
                "/api/reports/admin",
                "/api/reports/admin/**"
        ).hasRole("ADMIN")
        .anyRequest().permitAll()
)
```

따라서 현재 구조를 "모든 API에 JWT 인증이 적용되었다"고 표현하면 정확하지 않다. `/api/users/me`처럼 컨트롤러가 `@AuthenticationPrincipal`을 직접 확인하는 API는 토큰 없이 호출하면 실패하지만, 필터 체인 단계에서 모든 보호 API를 일관되게 차단하는 상태는 아니다.

회원가입과 로그인, Swagger 같은 공개 경로만 `permitAll()`로 두고 사용자 API에는 `authenticated()`를 적용하는 구성이 더 명확하다.

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

실제 공개 API가 더 있다면 운영 정책에 맞게 명시적으로 추가해야 한다. 핵심은 토큰을 해석하는 인증 로직과 URL별 접근 권한을 정하는 인가 정책을 함께 완성하는 것이다.

## 토큰은 어디에 저장해야 할까?

현재 프론트엔드 API 문서의 예시는 액세스 토큰을 `localStorage`에 저장하고 요청마다 `Authorization` 헤더에 넣는다.

```typescript
const token = localStorage.getItem('accessToken');

const response = await fetch('/api/users/me', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

구현이 단순하고 모바일 앱이나 API 클라이언트에도 같은 규칙을 사용할 수 있다는 장점이 있다. 그러나 페이지에서 실행된 JavaScript가 토큰에 접근할 수 있으므로 XSS 공격이 발생하면 토큰을 탈취당할 수 있다.

브라우저 서비스에서는 다음 대안도 검토할 수 있다.

- 액세스 토큰을 메모리에만 두고 수명을 짧게 설정한다.
- Refresh Token은 `HttpOnly`, `Secure`, `SameSite` 속성을 적용한 쿠키로 관리한다.
- 모든 사용자 입력을 안전하게 처리하고 CSP를 적용해 XSS 위험을 낮춘다.

JWT를 쿠키에 넣으면 JavaScript의 직접 접근을 차단할 수 있지만, 브라우저가 쿠키를 자동으로 전송하므로 CSRF 방어를 다시 고려해야 한다. 현재 프로젝트처럼 Authorization 헤더로 토큰을 보내는 구조와 쿠키 기반 구조는 같은 보안 설정을 그대로 사용할 수 없다.

## 현재 구현에서 보완할 점

이번 구현으로 기본 로그인과 토큰 검증 흐름은 완성했지만 운영 환경을 생각하면 다음 항목을 보완해야 한다.

### 비밀키를 환경변수로 분리하기

JWT 서명키가 저장소의 설정 파일에 직접 들어가면 코드에 접근할 수 있는 사람이 유효한 토큰을 위조할 수 있다. 이미 노출된 키는 환경변수로 옮기는 것만으로 끝나지 않고 반드시 새 키로 교체해야 한다.

```properties
jwt.secret=${JWT_SECRET}
jwt.expiration=${JWT_EXPIRATION:86400000}
```

운영 환경에서는 충분히 긴 무작위 키를 Secret Manager나 배포 환경의 보안 변수로 관리해야 한다. 로그에도 원본 토큰이나 비밀키를 남기지 않는다.

### Access Token과 Refresh Token 분리하기

24시간 동안 유효한 액세스 토큰은 탈취되었을 때 공격자도 같은 시간 동안 사용할 수 있다. 액세스 토큰의 수명을 짧게 하고, 더 긴 수명의 Refresh Token으로 재발급하는 구조를 고려할 수 있다.

이때 Refresh Token 저장, 회전(rotation), 재사용 탐지, 로그아웃 시 폐기 정책까지 함께 설계해야 한다. Refresh Token을 추가하는 것만으로 보안이 자동으로 좋아지는 것은 아니다.

### 로그아웃과 강제 폐기 정책 정하기

현재 JWT는 서버가 별도 상태를 보관하지 않으므로 클라이언트가 토큰을 삭제해도 이미 복사된 토큰은 만료 전까지 유효하다. 비밀번호 변경, 계정 정지, 강제 로그아웃을 즉시 반영하려면 다음과 같은 전략이 필요하다.

- 짧은 액세스 토큰 만료 시간을 사용한다.
- Refresh Token을 서버에서 폐기한다.
- 꼭 필요한 경우 토큰 차단 목록을 운영한다.
- 사용자별 토큰 버전을 두고 이전 버전의 토큰을 거부한다.

서비스의 위험도와 운영 복잡도를 고려해 필요한 수준을 선택해야 한다.

### 인증 실패 응답 통일하기

토큰이 없거나 잘못된 경우에는 `401 Unauthorized`, 인증은 되었지만 권한이 부족한 경우에는 `403 Forbidden`을 일관되게 반환해야 한다. `AuthenticationEntryPoint`와 `AccessDeniedHandler`를 적용하면 클라이언트가 로그인 만료와 권한 부족을 구분해 처리하기 쉬워진다.

### 인증 흐름을 테스트로 고정하기

로그인 성공만 확인해서는 보안 설정의 회귀를 막기 어렵다. 최소한 다음 시나리오는 통합 테스트로 유지하는 것이 좋다.

- 공개 API는 토큰 없이 호출할 수 있다.
- 보호 API는 토큰이 없거나 잘못되면 `401`을 반환한다.
- 일반 사용자가 관리자 API를 호출하면 `403`을 반환한다.
- 만료되거나 서명이 변조된 토큰은 거부한다.
- 비밀번호와 원본 JWT가 로그에 기록되지 않는다.
- 허용되지 않은 STOMP destination의 `MESSAGE`와 `SUBSCRIBE`를 거부한다.

## 구현을 통해 정리한 내용

JWT 로그인은 단순히 문자열 토큰 하나를 만드는 기능이 아니었다. 다음 요소가 하나의 흐름으로 연결되어야 했다.

1. BCrypt로 비밀번호를 안전하게 저장한다.
2. Spring Security로 이메일과 비밀번호를 인증한다.
3. 사용자와 권한, 만료 시간을 담은 JWT에 서명한다.
4. 클라이언트가 요청마다 Bearer 토큰을 전송한다.
5. 필터가 토큰을 검증해 `SecurityContext`를 구성한다.
6. URL과 역할에 맞는 인가 규칙을 적용한다.
7. 만료, 재발급, 로그아웃과 비밀키 운영 정책을 정한다.
8. HTTP와 STOMP 인가 규칙을 통합 테스트로 검증한다.

{{< conclusion >}}
**결론:** 쿠키는 인증 정보를 운반하는 수단이고, 세션과 JWT는 인증 상태를 관리하는 서로 다른 방식이다. MyGomi는 Spring Security와 JWT를 이용해 stateless 로그인 기반을 만들었고 REST API와 STOMP 연결에서 같은 인증 정보를 활용했다. 다음 단계는 보호할 API의 인가 규칙을 명확히 하고, 비밀키·토큰 저장·재발급·폐기 정책을 운영 환경에 맞게 보완하는 것이다.
{{< /conclusion >}}

## 참고 자료

- [Spring Security Reference - Session Management](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html)
- [Spring Security Reference - Password Storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
- [Spring Security Reference - Authorize HttpServletRequests](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)
- [Spring Security Reference - WebSocket Security](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html)
- [RFC 7519 - JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [OWASP - JSON Web Token Cheat Sheet for Java](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [OWASP - HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
