---
title: "Spring WebSocketとSTOMPでリアルタイムチャット・予約機能を実装する"
date: 2026-08-23
draft: false
description: "HTTPとWebSocketの役割分担から、STOMP、SockJS、JWT認証、チャットメッセージの永続化、双方の合意による予約処理までを実装の流れに沿って解説します。"
tags: ["Spring Boot", "WebSocket", "STOMP", "SockJS", "JWT", "JPA"]
categories: ["Spring Boot"]
showTableOfContents: true
---

MyGomiの譲渡投稿には、投稿者と申請者が会話できるチャット機能が必要だった。ただメッセージをリアルタイムで交換するだけではなく、会話中に二人が譲渡予約へ同意した場合、投稿の状態を`OPEN`から`RESERVED`へ変更しなければならない。

この要件に対し、すべてをWebSocketで処理する設計にはしなかった。チャットルームの作成・一覧、過去メッセージ、予約状態の取得と同意はHTTP APIで処理し、**新しいメッセージのリアルタイム送受信だけをWebSocketとSTOMPで実装**した。

{{< conclusion >}}
**リアルタイムチャットの要点はWebSocketそのものではなく、責務の分離にある。** 照会と明確な結果を伴う状態変更はHTTP、接続中の利用者へ即時に届けるイベントはWebSocketが担当する。メッセージはDBへ保存してから配信し、予約はチャットルームごとに二人の同意を保存したうえで投稿状態を変更する。
{{< /conclusion >}}

## HTTPだけでチャットを作る場合の問題

HTTPはクライアントのリクエストにサーバーがレスポンスを返す仕組みだ。メッセージ送信は`POST /messages`で実装できるが、相手の画面へ新着メッセージをすぐ表示するには追加の仕組みが必要になる。

一定間隔で新着を問い合わせるpollingは簡単だが、メッセージがなくてもリクエストが繰り返される。間隔を長くするとリアルタイム性が下がり、短くすると不要な通信が増える。双方向のやり取りが頻繁なチャットでは、一度接続した後も双方からデータを送れるWebSocketが適している。

| 項目 | HTTP | WebSocket |
| --- | --- | --- |
| 通信形態 | リクエストとレスポンス | 接続を維持する双方向通信 |
| サーバーからの送信 | 通常のリクエストだけでは難しい | 接続中のクライアントへ即時送信できる |
| 適した用途 | 照会、作成、更新、明確な処理結果 | チャット、通知、リアルタイム更新 |
| 注意点 | 各リクエストが独立 | 接続、再接続、購読解除の管理が必要 |

WebSocketはHTTPの代替ではない。過去メッセージのpaginationや予約トランザクションはHTTPのほうが扱いやすいため、MyGomiでは両方を組み合わせる。

## WebSocket・STOMP・SockJSの役割

### WebSocket

WebSocketは一つの接続上で双方向通信を可能にするプロトコルだ。ただし「どのチャットルーム宛てか」「送信と購読をどう区別するか」といったメッセージの意味までは定義しない。

### STOMP

STOMPはWebSocket上で利用できるメッセージングプロトコルで、`CONNECT`、`SEND`、`SUBSCRIBE`などのコマンドとdestinationを提供する。

| 操作 | destination | 方向 |
| --- | --- | --- |
| メッセージ送信 | `/pub/chat/message` | クライアント → サーバー |
| ルーム購読 | `/sub/chat/room/{roomId}` | サーバー → 購読者 |

クライアントが`/pub/chat/message`へ送信すると、サーバーは認証・権限確認・保存を行い、`/sub/chat/room/{roomId}`の購読者へ保存済みメッセージを配信する。

### SockJS

SockJSはWebSocketを利用できない環境で代替transportを提供する。サーバー側ではSTOMP endpointに`.withSockJS()`を指定し、フロントエンドでは`sockjs-client`を利用する。

## 全体アーキテクチャ

```text
                         ┌─ ChatRoom ─ ChatMessage
クライアント ─ HTTP API ─┤
                         └─ ReservationAgreement ─ SharePost.status

クライアント ─ WebSocket/STOMP ─ 認証・認可 ─ ChatController
                                           │          │
                                        JWT・参加確認  保存後に配信
                                           └─ /sub/chat/room/{roomId}
```

| 機能 | 通信方式 | 理由 |
| --- | --- | --- |
| ルーム作成・一覧 | HTTP | `roomId`や一覧を明確なレスポンスで受け取る |
| 過去メッセージ | HTTP | ソートとpaginationを適用しやすい |
| 新規メッセージ | WebSocket/STOMP | 接続中の利用者へ即時配信する |
| 予約状態・同意 | HTTP | トランザクションの成否と状態を明確に返す |

## SpringのSTOMP設定

依存関係を追加する。

```gradle
implementation 'org.springframework.boot:spring-boot-starter-websocket'
```

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

`/pub`で始まるメッセージは`@MessageMapping`へ、`/sub`は内蔵simple brokerへ渡る。本番環境では`setAllowedOriginPatterns("*")`をそのまま使わず、実際のフロントエンドOriginだけを許可する。

## データモデル

### ChatRoom

一つのルームは対象の譲渡投稿と、申請者`buyer`、投稿者`seller`を持つ。

```java
@Entity
public class ChatRoom extends BaseTimeEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    private SharePost sharePost;

    @ManyToOne(fetch = FetchType.LAZY)
    private User buyer;

    @ManyToOne(fetch = FetchType.LAZY)
    private User seller;
}
```

同じ申請者が同じ投稿に複数のルームを作らないよう、サービスの存在確認に加えて`(share_post_id, buyer_id)`へUNIQUE制約を設定する。アプリケーションの確認だけでは同時リクエストを完全には防げないため、DB制約を最後の防御線にする。

### ChatMessage

```java
@Entity
public class ChatMessage extends BaseTimeEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    private User sender;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;
}
```

リアルタイム配信後もDBへ残すため、再入室時に履歴を復元できる。クライアントから送信者IDを受け取らず、認証済み`Principal`から送信者を決定することが重要だ。

### ChatRoomReservationAgreement

予約同意は投稿単位ではなく、**チャットルームと利用者の組み合わせ**で保存する。一つの投稿に複数の申請者ルームが存在し得るため、どの二人が合意したかを`roomId`で区別する必要がある。

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

## チャットルーム作成

```http
POST /api/chat/room?sharePostId=123
Authorization: Bearer eyJ...
```

サーバーはJWT由来の`Principal`から現在の利用者を取得する。処理は次の順序になる。

1. 投稿と現在の利用者、投稿者を取得する。
2. 同じ投稿・申請者のルームがあれば既存`roomId`を返す。
3. 投稿者が自分自身とのルームを作る場合は拒否する。
4. 申請者をbuyer、投稿者をsellerとして保存する。

## STOMP CONNECTでJWT認証する

ブラウザのWebSocket handshakeやSockJSのHTTP transportには、通常のAPIと同じように任意の認証ヘッダーを付けにくい。そのためJWTはSTOMP `CONNECT`のネイティブヘッダーへ入れる。

```typescript
const client = new Client({
  webSocketFactory: () => new SockJS('/ws-stomp'),
  connectHeaders: {
    Authorization: `Bearer ${accessToken}`,
    'X-CSRF-TOKEN': csrfToken,
  },
});
```

サーバーはinbound channelでトークンを検証する。トークンがない、形式が違う、期限切れである場合は、匿名接続のまま通過させず`CONNECT`を拒否する。

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
            throw new BadCredentialsException("STOMP認証トークンがありません。");
        }

        String token = rawToken.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            throw new BadCredentialsException("無効なSTOMPトークンです。");
        }

        accessor.setUser(jwtTokenProvider.getAuthentication(token));
        return message;
    }
}
```

この認証処理はSpring Securityのメッセージ認可より先に実行されなければならない。公式ドキュメントに従い、別の設定クラスで優先順位を指定する。

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

## 購読時にルーム参加者を確認する

認証は「誰か」を確認するだけで、「そのルームへ入れるか」は判断しない。`/sub/chat/room/{roomId}`への`SUBSCRIBE`では、認証利用者がbuyerまたはsellerであることを確認する。

```java
if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
    String destination = accessor.getDestination();

    if (destination != null
            && destination.startsWith("/sub/chat/room/")) {
        Long roomId = Long.parseLong(destination.substring(15));
        String email = accessor.getUser().getName();

        User user = userRepository.findByEmail(email).orElseThrow();
        ChatRoom room = chatRoomRepository.findById(roomId).orElseThrow();

        boolean participant =
                room.getBuyer().getId().equals(user.getId())
                || room.getSeller().getId().equals(user.getId());

        if (!participant) {
            throw new AccessDeniedException("このチャットルームを購読できません。");
        }
    }
}
```

room IDの推測だけで他人の会話を購読できないようにする。送信処理でも同じ参加者チェックを行い、購読権限と送信権限を別々に守る。

## destinationをSpring Securityで保護する

参加者チェックより前に、メッセージ種別とdestinationに共通ルールを適用する。特に`/sub/**`はサーバーから購読者へ配信する経路なので、クライアントからの直接`SEND`を許可してはいけない。

```java
@Configuration
@EnableWebSocketSecurity
public class WebSocketSecurityConfig {

    @Bean
    AuthorizationManager<Message<?>> messageAuthorizationManager(
            MessageMatcherDelegatingAuthorizationManager.Builder messages) {
        messages
                .simpTypeMatchers(SimpMessageType.CONNECT).authenticated()
                .simpDestMatchers("/pub/**").authenticated()
                .simpSubscribeDestMatchers("/sub/chat/room/**").authenticated()
                .simpDestMatchers("/sub/**").denyAll()
                .anyMessage().denyAll();
        return messages.build();
    }
}
```

`simpSubscribeDestMatchers`が先に評価されるため正規の購読は許可され、その後の`simpDestMatchers("/sub/**").denyAll()`がクライアントからの直接`SEND`を拒否する。

`@EnableWebSocketSecurity`はSame Origin保護のため、デフォルトでSTOMP `CONNECT`に有効なCSRF tokenも要求する。上の例のようにサーバーから取得したtokenを`X-CSRF-TOKEN`として送る。stateless JWT方針でmessaging CSRFを使わない場合は別のsecurity設定が必要だが、その場合もOrigin制限とdestination認可を省略してはいけない。

認証済みであることと、対象ルームの参加者であることは異なる。この設定に加え、SUBSCRIBE interceptorとservice層の参加者チェックを維持する。最後を`denyAll()`にすることで、想定していないフレームを許可しない。

## 保存してから配信する

```java
@MessageMapping("/chat/message")
public void message(
        @Valid ChatMessageRequestDto request,
        Principal principal) {
    ChatMessageResponseDto saved =
            chatService.saveMessage(request, principal.getName());

    messagingTemplate.convertAndSend(
            "/sub/chat/room/" + request.getRoomId(),
            saved
    );
}
```

`saveMessage()`はルームと送信者を取得し、参加者であることを再確認してからメッセージを保存する。トランザクションサービスが正常に戻った後、保存済みIDと作成時刻を含むDTOを配信する。先に画面へ配信して保存に失敗すると、再読み込みで消えるメッセージが生まれるためだ。

ただしDB commitとbrokerへのpublishは一つの原子的トランザクションではない。commit直後にbroker障害が起きれば、保存済みだがリアルタイム配信されない可能性がある。強い配信保証が必要なら、transactional eventとoutbox patternで再試行可能なイベントを管理する。

入力DTOには空白と長さの検証も必要だ。

```java
public record ChatMessageRequestDto(
        @NotNull Long roomId,
        @NotBlank @Size(max = 2000) String message
) {}
```

フロントエンドでは受信メッセージをHTMLとして挿入せず、textとして描画してXSSを防ぐ。

## 過去メッセージはHTTPで取得する

```http
GET /api/chat/room/1/messages
Authorization: Bearer eyJ...
```

入室時は過去メッセージを古い順で取得し、その後リアルタイム購読を開始する。HTTP API側でも現在の利用者がルーム参加者か確認しなければならない。WebSocketだけを守っても、room IDを変えてHTTP履歴を取得できれば意味がない。

履歴取得と購読開始の間に届くメッセージを取りこぼす可能性もある。規模が大きくなれば、先に購読して最後に受信したmessage IDを基準に履歴を同期する、またはsequenceを導入する。

メッセージ数が増えたら全件取得をやめ、`messageId`または`createdAt`をcursorにしたpaginationへ変更する。

## 双方の同意による予約

投稿状態は次のように管理する。

```java
public enum ShareStatus {
    OPEN,
    RESERVED,
    COMPLETED,
    DELETED
}
```

予約のルールは次のとおりだ。

- 投稿が`OPEN`のときだけ新規同意を受け付ける。
- ルームのbuyerとsellerだけが状態取得・同意できる。
- 一人につき同じルームで一度だけ同意できる。
- 二人が同意すると投稿を`RESERVED`へ変更する。
- 同じ投稿に複数ルームがあっても同意はルームごとに分離する。

```http
POST /api/share-posts/123/reservation/agree?roomId=1
Authorization: Bearer eyJ...
```

serviceは一つのトランザクション内でroom・post・participantの関係を確認し、同意を保存する。二件の同意が揃ったときだけ投稿状態を変更する。既に同意済みなら新しいrowを作らず現在状態を返し、重複リクエストに対して安定した結果にする。

二人がほぼ同時に同意する場合や、同じ投稿の別ルームで同時に予約する場合には競合が起こり得る。投稿rowへ`PESSIMISTIC_WRITE`を使うか、`@Version`による楽観的ロックを導入し、同じ投稿が二つのルームで予約されないようにする。

## 予約処理をHTTPにした理由

予約はチャット画面のボタンから始まるが、本質はビジネス状態の変更だ。HTTPを使うと成功・失敗をstatus codeで表現し、変更後の状態をbodyで返し、トランザクションと再試行ルールを通常のservice層で管理しやすい。

相手の画面も即時更新したい場合、予約処理そのものはHTTPのまま維持し、commit後に`/sub/chat/room/{roomId}/reservation`へ状態変更イベントだけを配信する。**状態の正本はDBとHTTPレスポンス、WebSocketは変更通知**という分担にする。

## フロントエンド接続例

```typescript
const client = new Client({
  webSocketFactory: () => new SockJS('/ws-stomp'),
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
  if (!client.connected || !message.trim()) return;

  client.publish({
    destination: '/pub/chat/message',
    body: JSON.stringify({ roomId, message }),
  });
}
```

実際のUIでは接続中・接続済み・再接続中・失敗を区別し、接続前の送信と二重送信を防ぐ。画面を離れるときは購読を解除し、不要になった接続を終了する。

## 運用前に補強する点

### HTTP APIも認証・認可する

`/api/chat/**`と予約APIを`authenticated()`にし、履歴・一覧・予約状態の各serviceでもルーム参加者を確認する。認証なしのアクセスはfilter段階で一貫して`401 Unauthorized`にする。

### Originを限定する

開発用の`setAllowedOriginPatterns("*")`は本番で使用しない。HTTPSを使用し、環境設定から実際のフロントエンドOriginだけを許可する。

### 外部brokerへ拡張する

`enableSimpleBroker()`は一つのapplication instance内のメモリでsubscriptionを管理する。複数台構成では、RabbitMQやActiveMQへのSTOMP broker relayなどを使ってinstance間でメッセージを共有する。順序、重複、再配信、障害復旧の方針も同時に決める。

### 時刻を標準化する

サーバー固有の`yyyy-MM-dd HH:mm`ではなく、timezoneを含むISO 8601またはUTCを返し、クライアントで利用者の現地時刻へ変換する。

## 確認すべきテスト

1. トークンなし・期限切れの`CONNECT`が拒否されるか。
2. 第三者が別ルームを購読・送信できないか。
3. クライアントから`/sub/**`へ直接`SEND`できないか。
4. 正常メッセージが一度だけ保存され、対象ルームだけに配信されるか。
5. DB保存失敗時に配信されないか。
6. 再接続時に履歴とリアルタイムデータの欠落・重複がないか。
7. 別ルームから同じ投稿を同時予約しても一方だけが成功するか。

## まとめ

1. HTTPとWebSocketの責務を分ける。
2. STOMP destinationで送信と購読の経路を定義する。
3. JWTを`CONNECT`で検証し、認証失敗は接続段階で拒否する。
4. destinationをdefault denyで保護し、参加者権限を別途確認する。
5. メッセージを保存してから対象ルームへ配信する。
6. 過去履歴はHTTPで取得し、同じ参加者認可を適用する。
7. 予約同意をルーム単位で記録し、双方同意後に投稿を更新する。
8. 同時実行制御、pagination、outbox、外部brokerを運用規模に合わせて追加する。

{{< conclusion >}}
**結論:** MyGomiはHTTPとSTOMP over SockJSを組み合わせ、履歴・予約状態とリアルタイムメッセージを分離した。`CONNECT`でJWTを検証し、destinationをdefault denyで保護したうえで、buyerとsellerだけが購読・送信・予約できるように参加者権限を再確認する。予約はルームごとの双方同意をトランザクションで保存し、投稿を`RESERVED`へ遷移させる。運用時にはHTTP履歴の認可、予約の同時実行制御、outboxによる配信保証、外部brokerへの拡張も必要になる。
{{< /conclusion >}}

## 参考資料

- [Spring Framework Reference - WebSocket](https://docs.spring.io/spring-framework/reference/web/websocket.html)
- [Spring Framework Reference - STOMP](https://docs.spring.io/spring-framework/reference/web/websocket/stomp.html)
- [Spring Framework Reference - Token Authentication](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication-token-based.html)
- [Spring Security Reference - WebSocket Security](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html)
- [Spring Framework Reference - Simple Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-simple-broker.html)
- [Spring Framework Reference - External Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-broker-relay.html)
- [STOMP Protocol Specification 1.2](https://stomp.github.io/stomp-specification-1.2.html)
