---
title: "Spring WebSocket와 STOMP로 실시간 채팅·예약 기능 구현하기"
date: 2026-08-23
draft: false
description: "HTTP와 WebSocket의 차이부터 STOMP 기반 실시간 채팅, JWT 인증, 메시지 저장, 양측 동의 예약 처리까지 MyGomi 백엔드 구현을 자세히 살펴봅니다."
tags: ["Spring Boot", "WebSocket", "STOMP", "SockJS", "JWT", "JPA"]
categories: ["Spring Boot"]
showTableOfContents: true
---

MyGomi의 나눔 게시글에는 작성자와 신청자가 대화할 수 있는 채팅 기능이 필요했다. 단순히 메시지만 실시간으로 주고받는 것으로 끝나지 않고, 대화 중 두 사람이 모두 나눔 예약에 동의하면 게시글 상태도 `OPEN`에서 `RESERVED`로 바뀌어야 했다.

이 요구사항을 구현하면서 모든 기능을 WebSocket으로 처리하지는 않았다. 채팅방 생성, 채팅방 목록, 과거 메시지 조회, 예약 상태 조회와 동의는 HTTP API로 처리하고 **새 메시지를 실시간으로 주고받는 부분만 WebSocket과 STOMP로 구현**했다.

{{< conclusion >}}
**실시간 채팅의 핵심은 WebSocket 하나가 아니라 역할 분리다.** 조회와 상태 변경은 HTTP가 담당하고, 연결된 사용자에게 즉시 전달해야 하는 메시지는 WebSocket이 담당한다. 메시지는 전송 전에 DB에 저장하며, 예약은 채팅방 참여자 두 명의 동의를 별도 테이블에 기록한 뒤 게시글 상태를 변경한다.
{{< /conclusion >}}

이 글에서는 HTTP, WebSocket, STOMP, SockJS의 차이부터 MyGomi의 채팅방 생성, JWT 인증, 메시지 저장과 발행, 예약 동의 처리까지 실제 코드 흐름을 따라가며 정리한다.

## HTTP만으로 채팅을 만들면 어떤 문제가 생길까?

HTTP는 기본적으로 클라이언트가 요청하고 서버가 응답하는 구조다. 클라이언트가 새 메시지를 보내는 것은 `POST /messages` 같은 API로 구현할 수 있지만, 상대방의 화면에 새 메시지를 즉시 표시하려면 별도의 방법이 필요하다.

가장 단순한 방법은 일정 간격으로 서버에 새 메시지가 있는지 요청하는 polling이다.

```text
클라이언트 → 새 메시지가 있나요? → 서버
클라이언트 → 새 메시지가 있나요? → 서버
클라이언트 → 새 메시지가 있나요? → 서버
```

구현은 쉽지만 메시지가 없어도 요청이 반복된다. polling 간격을 길게 하면 실시간성이 떨어지고, 짧게 하면 불필요한 요청이 늘어난다. Long Polling이나 Server-Sent Events도 선택지가 될 수 있지만 양방향으로 메시지를 자주 주고받는 채팅에는 WebSocket이 자연스럽다.

WebSocket은 최초 연결 과정 이후 하나의 연결을 유지한다. 연결이 유지되는 동안 클라이언트와 서버가 필요할 때 서로 데이터를 보낼 수 있다.

| 구분 | HTTP | WebSocket |
| --- | --- | --- |
| 기본 통신 형태 | 요청 후 응답 | 연결을 유지하는 양방향 통신 |
| 서버의 자발적 전송 | 일반 요청만으로는 어려움 | 연결된 클라이언트에 즉시 전송 가능 |
| 적합한 작업 | 조회, 생성, 수정, 명확한 응답이 필요한 작업 | 채팅, 알림, 실시간 상태 갱신 |
| 연결 관리 | 요청마다 독립적 | 연결, 재연결, 구독 해제 관리 필요 |

WebSocket이 HTTP를 완전히 대체하는 것은 아니다. 채팅방 목록이나 수백 건의 과거 메시지를 연결할 때마다 WebSocket 프레임으로 다시 설계할 이유는 적다. 그래서 MyGomi는 두 방식을 함께 사용한다.

## WebSocket, STOMP, SockJS의 역할

세 용어는 비슷해 보이지만 담당하는 계층이 다르다.

### WebSocket

WebSocket은 클라이언트와 서버가 하나의 연결에서 양방향 통신을 할 수 있게 하는 프로토콜이다. 다만 WebSocket 자체는 데이터의 의미나 목적지를 정해 주지 않는다. 어떤 메시지가 채팅방 1번을 위한 것인지, 메시지 전송과 구독을 어떤 형식으로 구분할지는 애플리케이션이 정해야 한다.

### STOMP

STOMP는 WebSocket 위에서 사용할 수 있는 메시징 프로토콜이다. `CONNECT`, `SEND`, `SUBSCRIBE` 같은 명령과 destination 개념을 제공한다.

MyGomi에서는 다음 destination 규칙을 사용한다.

| 동작 | destination | 방향 |
| --- | --- | --- |
| 메시지 전송 | `/pub/chat/message` | 클라이언트 → 서버 |
| 채팅방 구독 | `/sub/chat/room/{roomId}` | 서버 → 구독자 |

클라이언트는 채팅방 1번에 들어갈 때 `/sub/chat/room/1`을 구독한다. 누군가 `/pub/chat/message`로 1번 방의 메시지를 보내면 서버는 저장과 권한 확인을 마친 뒤 `/sub/chat/room/1` 구독자들에게 메시지를 발행한다.

### SockJS

SockJS는 WebSocket을 사용할 수 없는 환경에서 다른 전송 방식으로 대체할 수 있도록 도와주는 라이브러리다. 서버에서는 STOMP 엔드포인트에 `.withSockJS()`를 적용했고, 프론트엔드에서도 `sockjs-client`를 사용한다.

```java
registry.addEndpoint("/ws-stomp")
        .setAllowedOriginPatterns("*")
        .withSockJS();
```

현재 모든 Origin을 허용한 설정은 개발 테스트를 위한 것이다. 운영 환경에서는 실제 프론트엔드 도메인만 허용해야 한다.

## 전체 아키텍처

MyGomi의 채팅과 예약 흐름은 다음과 같이 나뉜다.

```text
                         ┌─ ChatRoom ─ ChatMessage
클라이언트 ─ HTTP API ──┤
                         └─ ReservationAgreement ─ SharePost.status

클라이언트 ─ WebSocket/STOMP ─ StompHandler ─ ChatController
                                      │              │
                                   JWT·구독 검증   저장 후 발행
                                      │              │
                                      └── /sub/chat/room/{roomId}
```

기능별 통신 방식은 다음과 같다.

| 기능 | 통신 방식 | 이유 |
| --- | --- | --- |
| 채팅방 생성 | HTTP | 성공 여부와 `roomId`를 한 번의 응답으로 받는다. |
| 내 채팅방 목록 | HTTP | 일반 조회 작업이다. |
| 과거 메시지 조회 | HTTP | 정렬과 추후 pagination을 적용하기 쉽다. |
| 새 메시지 송수신 | WebSocket/STOMP | 연결된 두 사용자에게 즉시 전달한다. |
| 예약 상태 조회 | HTTP | 현재 DB 상태를 명확한 응답으로 받는다. |
| 예약 동의 | HTTP | 트랜잭션 결과와 변경된 게시글 상태를 확인한다. |

## Spring에서 STOMP 메시지 브로커 설정하기

프로젝트에는 `spring-boot-starter-websocket` 의존성을 추가했다.

```gradle
implementation 'org.springframework.boot:spring-boot-starter-websocket'
```

`WebSocketConfig`에서는 STOMP 엔드포인트와 발행·구독 prefix를 설정한다.

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig
        implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/pub");
        registry.enableSimpleBroker("/sub");
    }
}
```

`setApplicationDestinationPrefixes("/pub")`는 `/pub`으로 시작하는 메시지를 애플리케이션의 `@MessageMapping` 메서드로 전달한다. 반면 `enableSimpleBroker("/sub")`는 `/sub` destination을 구독한 클라이언트에게 메시지를 전달하는 내장 브로커를 활성화한다.

따라서 클라이언트가 `/pub/chat/message`로 메시지를 전송하면 `/pub`이 제거된 `/chat/message`와 일치하는 컨트롤러 메서드가 실행된다.

```java
@MessageMapping("/chat/message")
public void message(
        ChatMessageRequestDto request,
        Principal principal) {
    // 메시지 처리
}
```

## 채팅 데이터를 어떻게 설계했는가?

채팅 도메인은 `ChatRoom`, `ChatMessage`, `ChatRoomReservationAgreement` 세 엔티티를 중심으로 구성된다.

### ChatRoom

하나의 채팅방은 어떤 나눔 게시글에서 시작되었는지와 두 참여자가 누구인지 저장한다.

```java
@Entity
public class ChatRoom extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "share_post_id")
    private SharePost sharePost;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "buyer_id")
    private User buyer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id")
    private User seller;
}
```

코드에서는 나눔을 신청하고 먼저 채팅을 시작한 사용자를 `buyer`, 게시글 작성자를 `seller`라고 부른다. 무료 나눔 도메인에서는 `applicant`와 `owner` 같은 이름이 더 정확할 수도 있지만, 현재 DB와 코드에서는 buyer와 seller를 사용한다.

한 게시글에는 여러 신청자가 있을 수 있으므로 게시글 작성자는 여러 채팅방에 참여할 수 있다. 반면 한 신청자가 같은 게시글에 중복 채팅방을 만들면 안 된다. 이를 DB의 유니크 제약으로도 막았다.

```sql
ALTER TABLE chat_room
ADD CONSTRAINT uq_chat_room_share_post_buyer
UNIQUE (share_post_id, buyer_id);
```

### ChatMessage

메시지는 채팅방과 발신자를 참조하고 본문을 `TEXT`로 저장한다.

```java
@Entity
public class ChatMessage extends BaseTimeEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id")
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id")
    private User sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;
}
```

실시간 전송이 끝난 메시지도 DB에 남기 때문에 사용자가 채팅방을 나갔다가 다시 들어와도 과거 내역을 복원할 수 있다. `BaseTimeEntity`의 `createdAt`은 발송 시각을 만드는 데 사용한다.

### ChatRoomReservationAgreement

예약 동의는 게시글이나 사용자 컬럼 하나로 표현하지 않고 **채팅방과 사용자 조합**으로 저장한다.

```java
@Table(
    name = "chat_room_reservation_agreement",
    uniqueConstraints = @UniqueConstraint(
        columnNames = {"chat_room_id", "user_id"}
    )
)
public class ChatRoomReservationAgreement {

    @ManyToOne(fetch = FetchType.LAZY)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    private User user;

    private LocalDateTime agreedAt;
}
```

동의 정보를 방 단위로 관리하는 이유는 하나의 게시글에 여러 신청자의 채팅방이 생길 수 있기 때문이다. 어느 신청자와 작성자가 합의했는지 구분하려면 `postId`만으로는 부족하고 `roomId`가 필요하다.

`(chat_room_id, user_id)` 유니크 제약은 같은 사용자의 중복 동의를 DB에서도 차단한다. 서비스의 중복 확인은 사용자 경험을 위한 처리이고, 유니크 제약은 동시 요청까지 막는 최종 안전장치다.

## 채팅방 생성 흐름

사용자가 게시글에서 채팅하기 버튼을 누르면 다음 API를 호출한다.

```http
POST /api/chat/room?sharePostId=123
Authorization: Bearer eyJ...
```

`ChatController`는 JWT 인증 결과가 저장된 `Principal`에서 이메일을 얻는다. 클라이언트가 buyer ID나 이메일을 요청 데이터로 보내게 하지 않는 것이 중요하다.

```java
@PostMapping("/api/chat/room")
public ResponseEntity<Long> createRoom(
        @RequestParam Long sharePostId,
        Principal principal) {
    String email = principal.getName();
    Long roomId = chatService.createChatRoom(sharePostId, email);
    return ResponseEntity.ok(roomId);
}
```

서비스의 처리 순서는 다음과 같다.

1. `sharePostId`로 게시글을 조회한다.
2. JWT의 이메일로 현재 사용자를 조회한다.
3. 게시글의 `userId`로 작성자를 조회한다.
4. 현재 사용자가 이미 참여한 방이 있으면 기존 `roomId`를 반환한다.
5. 게시글 작성자가 자기 자신과 새 채팅방을 만들려고 하면 거부한다.
6. 신청자를 buyer, 작성자를 seller로 지정해 채팅방을 저장한다.

이미 존재하는 방을 반환하므로 같은 요청을 반복해도 애플리케이션 관점에서는 같은 결과를 기대할 수 있다. 여기에 `(share_post_id, buyer_id)` 유니크 제약을 더해 중복 방 생성을 이중으로 방지했다.

## JWT로 STOMP 연결 인증하기

HTTP 요청의 JWT는 `JwtAuthenticationFilter`가 처리하지만 STOMP의 `CONNECT`, `SUBSCRIBE`, `SEND` 프레임은 일반 컨트롤러 요청과 흐름이 다르다. MyGomi는 inbound channel에 `StompHandler`를 등록해 프레임이 애플리케이션에 도달하기 전에 검사한다.

클라이언트는 STOMP 연결 시 JWT를 네이티브 헤더로 전송한다.

```typescript
const client = new Client({
  webSocketFactory: () => new SockJS('http://localhost:8080/ws-stomp'),
  connectHeaders: {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-TOKEN': csrfToken,
  },
});
```

브라우저의 WebSocket handshake와 SockJS 전송 요청에는 일반 HTTP 요청처럼 임의의 인증 헤더를 자유롭게 넣기 어렵다. 따라서 STOMP `CONNECT` 프레임의 네이티브 헤더에 토큰을 담고 Spring의 client inbound channel에서 인증한다.

`CONNECT` 프레임이 들어오면 서버는 Bearer 토큰을 추출하고 서명과 만료 시간을 검사한다. 토큰이 없거나 유효하지 않으면 연결을 즉시 거부하고, 유효하면 `Authentication`을 STOMP 세션의 사용자로 설정한다.

```java
@Component
@RequiredArgsConstructor
public class StompAuthenticationInterceptor
        implements ChannelInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message, StompHeaderAccessor.class
        );

        if (accessor == null
                || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String rawToken = accessor.getFirstNativeHeader(
                HttpHeaders.AUTHORIZATION
        );
        if (!StringUtils.hasText(rawToken)
                || !rawToken.startsWith("Bearer ")) {
            throw new BadCredentialsException("STOMP 인증 토큰이 없습니다.");
        }

        String token = rawToken.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            throw new BadCredentialsException("유효하지 않은 STOMP 토큰입니다.");
        }

        Authentication authentication =
                jwtTokenProvider.getAuthentication(token);
        accessor.setUser(authentication);
        return message;
    }
}
```

Spring Security의 메시지 인가보다 인증 인터셉터가 먼저 실행되어야 한다. 이를 보장하려면 인터셉터 등록을 별도 설정으로 분리하고 우선순위를 지정한다.

```java
@Configuration
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
@RequiredArgsConstructor
public class WebSocketAuthenticationConfig
        implements WebSocketMessageBrokerConfigurer {

    private final StompAuthenticationInterceptor interceptor;

    @Override
    public void configureClientInboundChannel(
            ChannelRegistration registration) {
        registration.interceptors(interceptor);
    }
}
```

클라이언트가 요청 body에 `senderEmail`을 직접 넣는 구조라면 다른 사용자의 이메일로 메시지를 보내는 사칭이 가능하다. MyGomi의 메시지 요청에는 `roomId`와 `message`만 있고, 발신자는 서버가 인증된 `Principal`에서 결정한다.

```json
{
  "roomId": 1,
  "message": "안녕하세요, 아직 나눔 가능한가요?"
}
```

## 채팅방 구독 권한 확인하기

JWT가 유효하다는 사실만으로 모든 채팅방을 구독할 수 있게 해서는 안 된다. 인증은 사용자가 누구인지 알려 줄 뿐이고, 특정 방에 입장할 수 있는지는 별도의 인가 문제다.

클라이언트가 `/sub/chat/room/{roomId}`를 구독하면 `StompHandler`는 room ID를 추출하고 해당 사용자가 buyer 또는 seller인지 확인한다.

```java
if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
    String destination = accessor.getDestination();

    if (destination != null
            && destination.startsWith("/sub/chat/room/")) {
        Long roomId = Long.parseLong(destination.substring(15));
        String email = accessor.getUser().getName();

        User user = userRepository.findByEmail(email)
                .orElseThrow();
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow();

        boolean participant =
                room.getBuyer().getId().equals(user.getId())
                || room.getSeller().getId().equals(user.getId());

        if (!participant) {
            throw new IllegalArgumentException(
                    "이 채팅방에 입장할 수 없습니다."
            );
        }
    }
}
```

이 검사가 없으면 유효한 JWT를 가진 사용자가 room ID만 바꿔 다른 사람의 대화를 실시간으로 구독할 수 있다.

## STOMP destination을 Spring Security로 보호하기

방 참여자 검사는 세밀한 도메인 인가이고, 그 전에 메시지 종류와 destination에 대한 공통 규칙도 적용해야 한다. 특히 `/sub/**`는 서버가 브로커를 통해 구독자에게 발행하는 경로다. 클라이언트가 이 경로로 `SEND`할 수 있으면 서버가 보낸 것처럼 메시지를 위조할 수 있으므로 반드시 막아야 한다.

```java
@Configuration
@EnableWebSocketSecurity
public class WebSocketSecurityConfig {

    @Bean
    AuthorizationManager<Message<?>> messageAuthorizationManager(
            MessageMatcherDelegatingAuthorizationManager.Builder messages) {
        messages
                .simpTypeMatchers(SimpMessageType.CONNECT)
                    .authenticated()
                .simpDestMatchers("/pub/**")
                    .authenticated()
                .simpSubscribeDestMatchers("/sub/chat/room/**")
                    .authenticated()
                .simpDestMatchers("/sub/**")
                    .denyAll()
                .anyMessage()
                    .denyAll();

        return messages.build();
    }
}
```

이 설정은 인증되지 않은 연결·전송·구독을 차단하고 허용하지 않은 프레임은 기본적으로 거부한다. `simpSubscribeDestMatchers`가 먼저 평가되므로 정상적인 구독은 허용되지만, 그 뒤의 `simpDestMatchers("/sub/**").denyAll()`이 클라이언트의 직접 `SEND`를 막는다.

`@EnableWebSocketSecurity`는 Same Origin 보호를 위해 기본적으로 STOMP `CONNECT`에 유효한 CSRF 토큰도 요구한다. 위 클라이언트 예시처럼 서버가 발급한 토큰을 `X-CSRF-TOKEN` 헤더로 함께 보내야 한다. stateless JWT 정책 때문에 메시징 CSRF를 사용하지 않기로 결정했다면 별도의 보안 구성이 필요하며, 그 경우에도 Origin 제한과 destination 인가를 생략해서는 안 된다.

또한 `authenticated()`는 그 사용자가 해당 방의 참여자인지까지 알지 못한다. 따라서 앞서 작성한 `SUBSCRIBE` 인터셉터의 buyer·seller 검사와 메시지 저장 서비스의 전송 권한 검사를 함께 유지해야 한다. matcher는 위에서 아래로 평가되므로 허용할 규칙을 구체적으로 선언한 뒤 마지막을 `denyAll()`로 닫는다.

## 메시지를 저장한 뒤 발행하기

클라이언트가 `/pub/chat/message`로 메시지를 보내면 `@MessageMapping("/chat/message")` 메서드가 실행된다.

```java
@MessageMapping("/chat/message")
public void message(
        @Valid ChatMessageRequestDto request,
        Principal principal) {
    ChatMessageResponseDto savedMessage =
            chatService.saveMessage(request, principal.getName());

    messagingTemplate.convertAndSend(
            "/sub/chat/room/" + request.getRoomId(),
            savedMessage
    );
}
```

`ChatService.saveMessage()`는 다음 순서로 동작한다.

1. 요청의 `roomId`로 채팅방을 조회한다.
2. STOMP `Principal`의 이메일로 발신자를 조회한다.
3. 발신자가 해당 방의 buyer 또는 seller인지 다시 검사한다.
4. `ChatMessage`를 저장한다.
5. 저장된 메시지를 응답 DTO로 변환한다.
6. 컨트롤러가 방의 구독 destination으로 메시지를 발행한다.

구독 단계뿐 아니라 전송 단계에서도 참여자를 검사하는 것이 중요하다. 구독 권한과 메시지 전송 권한은 별도의 동작이므로 한쪽 검사만 믿어서는 안 된다.

또한 트랜잭션 서비스가 정상적으로 반환해 **DB 저장이 완료된 메시지만 발행**한다. 먼저 화면에 뿌리고 저장에 실패하면 사용자는 보았지만 새로고침 후 사라지는 메시지가 생길 수 있다. 현재 구조는 저장된 메시지 ID와 생성 시간을 포함한 DTO를 발행하므로 과거 내역과 실시간 수신 데이터의 형태도 동일하다.

다만 DB 커밋과 메시지 브로커 발행은 하나의 원자적 트랜잭션이 아니다. DB 저장 직후 브로커 장애가 발생하면 저장은 되었지만 실시간 전달은 실패할 수 있다. 전달 보장이 중요한 서비스라면 트랜잭션 이벤트와 outbox 패턴을 사용해 커밋된 이벤트를 재시도 가능한 형태로 발행해야 한다.

```json
{
  "messageId": 100,
  "senderEmail": "user@example.com",
  "senderNickname": "나눔받고싶어요",
  "message": "네, 가능합니다!",
  "sendTime": "2026-08-23 14:30"
}
```

## 과거 메시지는 HTTP로 불러오기

사용자가 채팅방에 들어오기 전에 주고받은 메시지는 WebSocket 구독만으로 받을 수 없다. 먼저 HTTP로 과거 내역을 조회한 뒤 실시간 구독을 시작한다.

```http
GET /api/chat/room/1/messages
Authorization: Bearer eyJ...
```

Repository는 생성 시각의 오름차순으로 메시지를 조회한다.

```java
List<ChatMessage>
findByChatRoomIdOrderByCreatedAtAsc(Long chatRoomId);
```

프론트엔드의 일반적인 입장 순서는 다음과 같다.

1. 게시글에서 시작했다면 채팅방 생성 API로 `roomId`를 얻는다.
2. 해당 방의 과거 메시지를 HTTP로 조회해 화면에 표시한다.
3. SockJS와 STOMP 클라이언트를 연결한다.
4. `/sub/chat/room/{roomId}`를 구독한다.
5. 새 메시지가 도착할 때마다 기존 목록 뒤에 추가한다.
6. 화면을 나갈 때 구독과 연결을 해제한다.

과거 메시지 조회와 실시간 구독 사이에 도착한 메시지를 놓칠 가능성도 고려해야 한다. 트래픽이 많아지면 먼저 구독한 뒤 마지막으로 받은 메시지 ID를 기준으로 내역을 동기화하거나, 서버가 sequence를 제공하는 방식을 검토할 수 있다.

## 내 채팅방 목록 만들기

채팅방 목록에서는 현재 사용자가 buyer인 방과 seller인 방을 모두 조회해야 한다.

```java
@Query("""
    SELECT cr FROM ChatRoom cr
    JOIN FETCH cr.buyer
    JOIN FETCH cr.seller
    JOIN FETCH cr.sharePost
    WHERE cr.buyer.id = :userId
       OR cr.seller.id = :userId
    """)
List<ChatRoom> findAllByUserId(Long userId);
```

`JOIN FETCH`로 두 사용자와 게시글을 함께 조회하므로 DTO를 만드는 과정에서 연관 엔티티마다 추가 쿼리가 실행되는 N+1 문제를 줄인다.

응답 DTO는 내가 buyer라면 seller의 닉네임을, 내가 seller라면 buyer의 닉네임을 상대방 이름으로 반환한다.

```json
{
  "roomId": 1,
  "sharePostId": 123,
  "postTitle": "이케아 의자 나눔합니다",
  "opponentNickname": "나눔천사"
}
```

`sharePostId`는 같은 화면에서 예약 상태 API를 호출할 때 사용한다.

## 채팅방 단위 예약 기능 설계

나눔 게시글의 상태는 다음 네 가지다.

```java
public enum ShareStatus {
    OPEN,
    RESERVED,
    COMPLETED,
    DELETED
}
```

예약 동의 기능에서 중요한 규칙은 다음과 같다.

- 게시글이 `OPEN`일 때만 새 예약 동의를 할 수 있다.
- 채팅방의 buyer와 seller만 해당 방의 예약 상태를 조회하거나 동의할 수 있다.
- 한 사용자는 같은 채팅방에서 한 번만 동의할 수 있다.
- 두 참여자가 모두 동의하면 게시글을 `RESERVED`로 변경한다.
- 한 게시글에 여러 채팅방이 있어도 동의는 각 방별로 분리한다.

단순히 게시글에 `reservedUserId` 하나만 저장하지 않고 동의 엔티티를 둔 이유는 예약이 **두 사람의 합의 과정**이기 때문이다. 누가 먼저 동의했는지, 상대방이 아직 동의하지 않았는지, 언제 동의했는지를 표현할 수 있다.

## 예약 상태 조회

채팅방 화면을 열면 다음 API로 현재 상태를 확인한다.

```http
GET /api/share-posts/123/reservation/status?roomId=1
Authorization: Bearer eyJ...
```

응답에는 게시글 상태와 양쪽의 동의 여부가 들어간다.

```json
{
  "data": {
    "postId": 123,
    "postStatus": "OPEN",
    "myAgreed": true,
    "otherAgreed": false,
    "bothAgreed": false
  }
}
```

서비스는 먼저 room ID, post ID, 현재 사용자 ID의 관계를 검증한다.

```java
ChatRoom room = chatRoomRepository
        .findByIdAndParticipant(roomId, currentUserId)
        .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "해당 채팅방을 찾을 수 없거나 예약 권한이 없습니다."
        ));

if (!room.getSharePost().getId().equals(postId)) {
    throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "해당 채팅방은 이 게시글의 채팅방이 아닙니다."
    );
}
```

방 참여자라는 조건과 해당 방이 요청한 게시글의 방이라는 조건을 모두 확인한다. room ID만 알거나 서로 관계없는 post ID와 room ID를 조합해서는 예약 상태에 접근할 수 없다.

그다음 방의 동의 수, 나의 동의 여부, 상대방의 동의 여부를 조회해 응답을 만든다.

```java
long agreedCount = agreementRepository
        .countByChatRoomId(room.getId());

boolean bothAgreed = agreedCount == 2;
boolean myAgreed = agreementRepository
        .existsByChatRoomIdAndUserId(
                room.getId(),
                currentUserId
        );
```

## 양측 동의로 게시글 예약하기

예약 동의 API는 다음과 같다.

```http
POST /api/share-posts/123/reservation/agree?roomId=1
Authorization: Bearer eyJ...
```

`agree()` 메서드는 하나의 트랜잭션 안에서 동의 저장과 게시글 상태 변경을 처리한다.

```java
@Transactional
public ReservationStatusResponseDto agree(
        Long postId,
        Long roomId,
        Long currentUserId) {
    ChatRoom room = findRoomByRoomIdOrThrow(
            roomId, postId, currentUserId
    );
    SharePost post = room.getSharePost();

    if (post.getStatus() != ShareStatus.OPEN) {
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "이미 예약되었거나 완료된 게시글입니다."
        );
    }

    // 중복 동의는 현재 상태를 그대로 반환
    // 새 동의 저장
    // 동의가 2개라면 RESERVED로 변경
}
```

이미 동의한 사용자가 버튼을 다시 눌렀을 때 새 row를 추가하지 않고 현재 상태를 반환한다. 같은 요청을 반복해도 결과가 바뀌지 않는 idempotent한 동작에 가깝게 만든 부분이다.

새 동의를 저장한 뒤 같은 방의 동의 목록이 두 건이면 게시글 상태를 변경한다.

```java
agreementRepository.save(
        ChatRoomReservationAgreement.builder()
                .chatRoom(room)
                .user(user)
                .build()
);

List<ChatRoomReservationAgreement> agreements =
        agreementRepository.findByChatRoomIdWithUser(room.getId());

if (agreements.size() == 2) {
    post.updateStatus(ShareStatus.RESERVED);
    sharePostRepository.saveAndFlush(post);
}
```

첫 번째 사용자가 동의하면 `myAgreed: true`, `otherAgreed: false` 상태가 된다. 상대방까지 동의하면 양쪽 모두 `true`가 되고 게시글은 `RESERVED`로 바뀐다. 이후 다른 채팅방에서 새로 동의하려고 하면 게시글이 더 이상 `OPEN`이 아니므로 거부된다.

## 예약을 WebSocket이 아닌 HTTP로 처리한 이유

채팅 화면 안에서 누르는 버튼이라고 해서 예약까지 반드시 WebSocket으로 구현할 필요는 없다. 예약 동의는 메시지보다 비즈니스 상태 변경의 성격이 강하다.

HTTP를 사용하면 다음이 명확해진다.

- 요청의 성공과 실패를 상태 코드로 표현할 수 있다.
- 변경된 예약 상태를 응답 body로 바로 받을 수 있다.
- 트랜잭션과 예외 처리를 일반 서비스 계층에서 관리하기 쉽다.
- API 문서와 테스트를 작성하기 쉽다.
- 재시도와 중복 요청에 대한 규칙을 정의하기 쉽다.

다만 한쪽이 동의했을 때 상대방 화면도 즉시 바뀌게 하려면 예약 처리 자체는 HTTP로 유지하면서, 트랜잭션 성공 후 `/sub/chat/room/{roomId}/reservation` 같은 destination으로 상태 변경 이벤트를 발행할 수 있다. **상태의 기준은 DB와 HTTP 응답으로 유지하고 WebSocket은 변경 알림에 사용**하는 방식이다.

## 프론트엔드 연결 예시

프론트엔드는 `sockjs-client`와 `@stomp/stompjs`를 사용할 수 있다.

```bash
npm install sockjs-client @stomp/stompjs
```

채팅방 진입과 메시지 전송의 핵심 흐름은 다음과 같다.

```typescript
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const roomId = 1;
const accessToken = localStorage.getItem('accessToken');

const client = new Client({
  webSocketFactory: () =>
    new SockJS('http://localhost:8080/ws-stomp'),
  connectHeaders: {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-TOKEN': csrfToken,
  },
  reconnectDelay: 5000,
  onConnect: () => {
    client.subscribe(`/sub/chat/room/${roomId}`, frame => {
      const received = JSON.parse(frame.body);
      setMessages(previous => [...previous, received]);
    });
  },
});

client.activate();

function sendMessage(message: string) {
  if (!client.connected || !message.trim()) {
    return;
  }

  client.publish({
    destination: '/pub/chat/message',
    body: JSON.stringify({ roomId, message }),
  });
}

// 화면을 나갈 때 실행
client.deactivate();
```

실제 화면에서는 연결 중, 연결 성공, 재연결 중, 실패 상태를 구분해야 한다. 전송 버튼을 중복으로 누르거나 연결 전에 메시지를 보내는 경우도 막아야 한다.

예약 동의는 별도의 HTTP 요청으로 처리한다.

```typescript
async function agreeReservation(postId: number, roomId: number) {
  const response = await fetch(
    `/api/share-posts/${postId}/reservation/agree?roomId=${roomId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('예약 동의에 실패했습니다.');
  }

  return response.json();
}
```

## 전체 사용자 시나리오

신청자와 게시글 작성자가 채팅을 시작해 예약하는 전체 과정은 다음과 같다.

1. 신청자가 로그인해 JWT를 발급받는다.
2. 나눔 게시글에서 채팅하기를 누른다.
3. HTTP API가 새 채팅방을 만들거나 기존 `roomId`를 반환한다.
4. 클라이언트가 과거 메시지와 예약 상태를 HTTP로 조회한다.
5. STOMP 연결의 `Authorization` 헤더에 JWT를 넣는다.
6. 연결 후 `/sub/chat/room/{roomId}`를 구독한다.
7. 신청자가 `/pub/chat/message`로 메시지를 보낸다.
8. 서버가 발신자와 방 참여 여부를 확인하고 메시지를 DB에 저장한다.
9. 저장된 메시지를 해당 방 구독자에게 발행한다.
10. 한쪽이 예약 동의 API를 호출하면 동의 row가 저장된다.
11. 상대방도 동의하면 게시글 상태가 `RESERVED`로 변경된다.
12. 이후 게시글 작성자가 나눔 완료 처리하면 `COMPLETED` 상태가 된다.

## 현재 구현에서 보완할 점

기본 채팅과 예약 흐름은 동작하지만 운영 환경에서는 다음 부분을 보완해야 한다.

### HTTP 채팅 API의 인증 규칙 명시하기

현재 `SecurityConfig`는 관리자 신고 API를 제외하고 `anyRequest().permitAll()`을 사용한다. 채팅방 생성과 목록 API는 `Principal`을 바로 사용하므로 토큰이 없으면 예외가 발생할 수 있지만, 보안 필터 단계에서 일관되게 `401 Unauthorized`를 반환하는 구조는 아니다.

```java
.requestMatchers("/api/chat/**").authenticated()
.requestMatchers(
        "/api/share-posts/*/reservation/**"
).authenticated()
```

공개 API와 인증 API를 명시적으로 나누고 `AuthenticationEntryPoint`를 적용하는 것이 좋다.

### 과거 메시지 조회에도 참여자 검증하기

실시간 구독과 메시지 전송에는 참여자 검사가 있지만 현재 `getMessages(roomId)`는 room ID만으로 내역을 조회한다. 유효한 사용자가 다른 room ID를 추측해 과거 메시지를 조회하지 못하도록 현재 사용자 ID 또는 이메일을 함께 전달하고 참여자 여부를 검사해야 한다.

```java
public List<ChatMessageResponseDto> getMessages(
        Long roomId,
        String userEmail) {
    // 사용자 조회
    // findByIdAndParticipant(roomId, userId)로 권한 확인
    // 확인 후 메시지 반환
}
```

채팅방 목록과 메시지 조회 같은 HTTP 엔드포인트에도 WebSocket과 동일한 인가 기준이 적용되어야 한다.

### Origin을 운영 도메인으로 제한하기

```java
.setAllowedOriginPatterns("*")
```

이 설정은 테스트에는 편하지만 어떤 웹사이트에서도 연결을 시도할 수 있다. 운영에서는 HTTPS를 사용하고 허용할 프론트엔드 Origin을 환경별 설정으로 제한해야 한다.

### 메시지 입력 검증하기

현재 `ChatMessageRequestDto`에는 메시지의 공백 여부나 최대 길이 검증이 없다. 빈 문자열, 지나치게 긴 본문, 예상하지 못한 데이터로부터 DB와 UI를 보호해야 한다.

```java
@NotNull
private Long roomId;

@NotBlank
@Size(max = 2000)
private String message;
```

STOMP payload에도 Bean Validation이 적용되도록 `@Valid` 사용과 예외 응답 방식을 함께 구성한다. 프론트엔드가 메시지를 HTML로 삽입한다면 XSS를 막기 위해 text로 렌더링해야 한다.

### 예약 동시성 제어하기

두 사용자가 거의 동시에 동의하거나 서로 다른 채팅방에서 동시에 마지막 동의를 완료할 수 있다. 단순 조회 후 상태를 변경하는 방식은 트랜잭션 타이밍에 따라 양쪽이 상대의 아직 커밋되지 않은 동의를 보지 못하거나 같은 `OPEN` 게시글을 동시에 예약하려는 경쟁 상태가 생길 수 있다.

게시글 row를 `PESSIMISTIC_WRITE`로 잠그거나 `@Version`을 이용한 낙관적 락을 적용하고, 동의 저장 뒤 DB의 count 결과를 기준으로 상태를 변경하는 방식을 검토해야 한다. 충돌한 요청에 어떤 상태 코드와 메시지를 반환할지도 정해야 한다.

### 예약 취소 정책 정하기

현재는 동의 추가 API만 있고 동의를 철회하거나 `RESERVED`를 `OPEN`으로 되돌리는 전용 흐름은 없다. 예약 취소를 지원한다면 다음 규칙이 필요하다.

- 한쪽이 동의한 상태에서 철회할 수 있는가?
- 양쪽 동의 후에는 누가 취소할 수 있는가?
- 취소하면 기존 agreement를 삭제할지 이력으로 남길지 결정한다.
- 다른 신청자의 채팅방을 다시 예약 가능 상태로 전환할지 결정한다.

상태를 단순히 되돌리기보다 예약 이벤트나 취소 시각을 기록하면 운영과 분쟁 대응에 유리하다.

### 메시지와 채팅방 목록을 pagination하기

현재 과거 메시지는 방의 전체 내역을 오래된 순서로 반환한다. 메시지가 쌓이면 한 번에 모두 읽는 비용이 커진다. `messageId` 또는 `createdAt`을 cursor로 사용해 최근 메시지부터 일정 개수씩 불러오는 방식이 적합하다.

채팅방 목록 쿼리에도 명시적인 정렬이 없다. 최근 메시지 시각, 마지막 메시지, 읽지 않은 개수를 함께 제공하면 실제 메신저에 가까운 목록을 만들 수 있다.

### 여러 서버에서는 외부 브로커 사용하기

`enableSimpleBroker()`가 만드는 단순 브로커는 한 애플리케이션 인스턴스 메모리 안에서 동작한다. 서버가 여러 대가 되면 A 서버에 연결된 사용자와 B 서버에 연결된 사용자가 같은 방을 구독해도 메시지가 자동으로 공유되지 않는다.

규모가 커지면 RabbitMQ 같은 외부 메시지 브로커의 STOMP relay나 Redis 기반 이벤트 전달을 검토해야 한다. 연결 상태, 메시지 순서, 중복 전달, 장애 후 재처리 정책도 함께 설계해야 한다.

### 시간 형식을 표준화하기

현재 메시지 응답은 `yyyy-MM-dd HH:mm` 문자열을 반환한다. 서버와 사용자의 시간대가 달라질 수 있는 서비스에서는 ISO 8601 형식과 timezone 또는 UTC 기준 값을 반환하고, 클라이언트가 현지 시간으로 표시하는 편이 안전하다.

## 반드시 확인할 테스트 시나리오

정상 연결만 확인해서는 보안과 동시성 문제를 찾기 어렵다. 최소한 다음 경우를 자동화 테스트나 통합 테스트로 검증해야 한다.

1. 토큰이 없거나 만료된 `CONNECT`가 거부되는가?
2. 제3자가 다른 방을 `SUBSCRIBE`하거나 그 방으로 메시지를 보낼 수 없는가?
3. 클라이언트가 `/sub/**`로 직접 `SEND`하면 거부되는가?
4. 참여자가 보낸 정상 메시지가 한 번 저장되고 같은 방에만 발행되는가?
5. DB 저장이 실패했을 때 메시지가 발행되지 않는가?
6. 재연결 후 HTTP 내역과 실시간 메시지 사이에 누락이나 중복이 없는가?
7. 서로 다른 채팅방에서 동시에 예약을 시도해도 한 방만 성공하는가?

## 구현하며 정리한 내용

실시간 채팅과 예약은 하나의 기술만 적용해서 끝나는 기능이 아니었다.

1. HTTP와 WebSocket의 역할을 나눈다.
2. STOMP destination으로 메시지의 발행과 구독 경로를 정한다.
3. 채팅방, 메시지, 예약 동의를 관계형 데이터로 저장한다.
4. JWT에서 얻은 사용자로 연결과 메시지 발신자를 인증한다.
5. 구독과 전송 양쪽에서 채팅방 참여 권한을 확인한다.
6. 메시지를 DB에 저장한 뒤 구독자에게 발행한다.
7. 예약 동의를 방 단위로 기록하고 양쪽 동의 후 게시글 상태를 변경한다.
8. destination 접근 제어, 입력 검증, 동시성, pagination과 브로커 확장을 보완한다.

{{< conclusion >}}
**결론:** MyGomi는 HTTP와 STOMP over SockJS를 함께 사용해 과거 내역과 실시간 메시지를 모두 처리했다. `CONNECT`의 JWT를 검증하고 destination을 기본 거부 방식으로 보호하며, buyer와 seller만 구독·전송·예약할 수 있도록 방 참여 여부를 다시 검사한다. 예약은 채팅방별 양측 동의를 트랜잭션으로 저장해 게시글을 `RESERVED`로 전환한다. 운영 단계에서는 HTTP 메시지 내역 인가, 예약 동시성, outbox 기반 전달 보장과 외부 브로커 확장을 추가로 고려해야 한다.
{{< /conclusion >}}

## 참고 자료

- [Spring Framework Reference - WebSocket](https://docs.spring.io/spring-framework/reference/web/websocket.html)
- [Spring Framework Reference - STOMP](https://docs.spring.io/spring-framework/reference/web/websocket/stomp.html)
- [Spring Framework Reference - Token Authentication](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication-token-based.html)
- [Spring Security Reference - WebSocket Security](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html)
- [Spring Framework Reference - Simple Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-simple-broker.html)
- [Spring Framework Reference - External Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-broker-relay.html)
- [MDN Web Docs - The WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [STOMP Protocol Specification](https://stomp.github.io/stomp-specification-1.2.html)
