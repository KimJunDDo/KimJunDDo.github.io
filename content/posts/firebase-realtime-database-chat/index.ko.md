---
title: "Firebase Realtime Database로 실시간 채팅 구현하기"
date: 2026-08-21
draft: false
description: "Firebase Realtime Database의 동작 방식과 데이터 구조를 이해하고, React Native와 TypeScript로 실시간 채팅을 구현하며 보안 규칙과 접속 상태 관리까지 살펴봅니다."
tags: ["Firebase", "Realtime Database", "React Native", "TypeScript", "Firebase Authentication"]
categories: ["Firebase"]
showTableOfContents: true
---

채팅을 구현하려면 새 메시지를 서버에 저장하는 것만으로는 부족하다. 한 사용자가 메시지를 보낸 순간 같은 채팅방을 보고 있는 다른 사용자의 화면도 갱신되어야 한다. 일반적인 HTTP API라면 클라이언트가 새 메시지의 존재를 반복해서 확인해야 하지만, Firebase Realtime Database는 데이터 변경을 구독 중인 클라이언트에 전달한다.

이 글에서는 Realtime Database의 기본 동작과 데이터 구조를 먼저 정리하고, React Native와 TypeScript로 최근 메시지 50개를 구독하는 채팅 화면을 구현한다. 마지막에는 실제 서비스에서 빠뜨리기 쉬운 Security Rules, 접속 상태, 비용과 성능까지 살펴본다.

{{< conclusion >}}
**핵심:** Realtime Database의 실시간 채팅은 특정 경로에 메시지를 저장하고 같은 경로의 변경을 구독하는 구조다. 구현 자체는 단순하지만, 운영 가능한 채팅을 만들려면 인증 사용자와 채팅방 참여자를 Security Rules에서 검증하고 구독 범위를 제한해야 한다.
{{< /conclusion >}}

## Firebase Realtime Database란?

Firebase Realtime Database는 데이터를 클라우드의 **하나의 JSON 트리**로 저장하는 NoSQL 데이터베이스다. 테이블과 행을 사용하는 관계형 데이터베이스와 달리 모든 데이터는 경로와 노드로 표현된다.

```text
/
├── rooms
│   └── room-1
│       ├── title
│       └── members
└── messages
    └── room-1
        ├── message-1
        └── message-2
```

클라이언트는 `messages/room-1` 같은 경로를 구독할 수 있다. 해당 경로의 데이터가 바뀌면 SDK가 변경 내용을 전달하고, 애플리케이션은 화면 상태를 갱신한다. 이 때문에 별도의 WebSocket 서버나 메시지 브로커를 직접 구축하지 않아도 실시간 기능을 만들 수 있다.

### 일반적인 HTTP 조회와 무엇이 다를까?

HTTP 기반 polling과 Realtime Database 구독을 비교하면 다음과 같다.

| 구분 | HTTP polling | Realtime Database 구독 |
| --- | --- | --- |
| 데이터 확인 | 일정 간격으로 요청 | 데이터가 바뀔 때 이벤트 수신 |
| 실시간성 | polling 간격에 영향받음 | 연결된 클라이언트에 즉시 동기화 |
| 서버 구성 | API와 저장소를 직접 구성 | Firebase SDK와 관리형 DB 사용 |
| 접근 제어 | 서버 코드에서 검사 | Authentication과 Security Rules로 검사 |
| 주요 고려 사항 | polling 주기와 서버 부하 | 구독 범위, 규칙, 다운로드 사용량 |

Realtime Database가 모든 백엔드 요구사항을 대신하는 것은 아니다. 복잡한 검색, 관계형 조회, 서버에서만 실행해야 하는 비즈니스 로직이 많다면 별도 서버나 다른 데이터베이스가 더 적합할 수 있다. 반면 채팅, 접속 상태, 간단한 알림처럼 **작은 데이터가 자주 바뀌고 여러 클라이언트가 같은 상태를 봐야 하는 기능**에는 잘 맞는다.

## 실시간 동기화는 어떻게 동작할까?

채팅 화면의 흐름은 크게 구독과 쓰기로 나뉜다.

```text
사용자 A ─ 메시지 저장 ─▶ messages/room-1
                              │
                              ├─ 변경 이벤트 ─▶ 사용자 A
                              └─ 변경 이벤트 ─▶ 사용자 B
```

1. 두 사용자가 `messages/room-1` 경로를 구독한다.
2. 사용자 A가 해당 경로 아래에 새 메시지를 저장한다.
3. Realtime Database가 쓰기를 처리하고 구독자에게 변경을 전달한다.
4. 각 클라이언트가 받은 스냅샷으로 화면을 갱신한다.

Firebase JavaScript SDK는 네트워크가 잠시 불안정해도 현재 실행 세션의 로컬 상태를 사용해 반응성 있는 화면을 제공하고, 연결이 복구되면 서버 상태와 동기화한다. 다만 JavaScript SDK의 Realtime Database 데이터가 앱 재시작 후에도 디스크에 영구 보존된다고 가정해서는 안 된다. 완전한 오프라인 내역이 필요하면 별도 로컬 저장소와 동기화 정책을 설계해야 한다.

클라이언트가 표시한 시각과 서버가 확정한 시각도 다를 수 있으므로 메시지 정렬 기준에는 기기의 `Date.now()`보다 `serverTimestamp()`를 사용하는 편이 안전하다.

## 프로젝트 설정하기

Firebase Console에서 프로젝트와 웹 앱을 만든 뒤 **Realtime Database**를 생성한다. 개발을 빠르게 시작하려고 Test mode를 선택할 수 있지만, 이 모드는 데이터가 외부에 공개될 수 있으므로 운영 전에 반드시 규칙을 변경해야 한다.

Firebase JavaScript SDK는 React Native에서 Realtime Database를 지원한다. 여기서는 Expo 기반 React Native 프로젝트를 예로 들며 Firebase SDK와 로그인 상태를 기기에 보존할 AsyncStorage를 설치한다.

```bash
npm install firebase
npx expo install @react-native-async-storage/async-storage
```

Firebase 설정과 Realtime Database 인스턴스를 별도 파일에서 초기화한다.

```ts
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getDatabase(app);
```

`databaseURL`은 데이터베이스를 만든 리전에 따라 형태가 다르므로 Console에 표시된 값을 사용한다. `EXPO_PUBLIC_` 변수는 앱 bundle에 포함되므로 비밀 저장소가 아니다. Firebase 설정의 `apiKey` 역시 클라이언트 앱 식별 정보이며 서버 비밀번호처럼 데이터를 보호하지 않는다. **데이터 보호는 Authentication, Security Rules, 필요하면 App Check로 구성해야 한다.**

`initializeAuth()`에 React Native용 persistence를 지정하면 앱을 다시 실행했을 때도 AsyncStorage에서 인증 상태를 복구할 수 있다. 이미 다른 곳에서 Auth를 초기화했다면 중복 초기화하지 말고 하나의 Firebase module에서 instance를 공유한다.

## 채팅 데이터 구조 설계하기

처음에는 채팅방 아래에 참여자와 모든 메시지를 함께 넣고 싶을 수 있다.

```text
rooms/{roomId}/messages/{messageId}
```

하지만 상위 경로를 읽으면 그 아래의 데이터도 함께 내려받는다. 채팅방 목록에 제목만 필요해도 과거 메시지까지 내려받는 구조가 될 수 있다. Realtime Database에서는 조회 단위와 권한 단위를 고려해 데이터를 가능한 한 평평하게 나누는 것이 좋다.

```json
{
  "rooms": {
    "room-1": {
      "title": "프로젝트 채팅",
      "members": {
        "user-a": true,
        "user-b": true
      }
    }
  },
  "messages": {
    "room-1": {
      "-Oabc123": {
        "senderId": "user-a",
        "senderName": "김준또",
        "text": "안녕하세요!",
        "createdAt": 1787443200000
      }
    }
  },
  "userRooms": {
    "user-a": {
      "room-1": true
    },
    "user-b": {
      "room-1": true
    }
  }
}
```

각 최상위 경로의 역할은 다음과 같다.

| 경로 | 역할 |
| --- | --- |
| `rooms/{roomId}` | 채팅방 제목과 참여자 저장 |
| `messages/{roomId}` | 채팅방별 메시지 저장 |
| `userRooms/{uid}` | 사용자가 참여한 채팅방 ID 조회 |

`userRooms`는 중복 데이터지만 사용자가 참여한 방을 찾기 위해 전체 `rooms`를 내려받는 일을 피할 수 있다. Realtime Database에서는 조회를 단순하고 작게 만들기 위해 필요한 데이터를 여러 경로에 중복 저장하는 비정규화가 자주 사용된다. 여러 경로를 함께 바꿔야 한다면 `update()`를 사용해 원자적으로 갱신할 수 있다.

## 메시지 저장하기

메시지 ID를 직접 만들기보다 `push()`로 새 참조를 생성한다. `push()`가 만드는 고유 키는 여러 사용자가 동시에 메시지를 보내도 충돌하지 않도록 설계되어 있다.

```ts
// src/features/chat/chatApi.ts
import type { User } from 'firebase/auth';
import {
  push,
  ref,
  serverTimestamp,
  set,
} from 'firebase/database';

import { db } from '../../lib/firebase';

export async function sendMessage(
  roomId: string,
  user: User,
  value: string,
) {
  const text = value.trim();

  if (!text || text.length > 1000) {
    throw new Error('메시지는 1자 이상 1000자 이하로 입력해 주세요.');
  }

  const messageRef = push(ref(db, `messages/${roomId}`));

  await set(messageRef, {
    senderId: user.uid,
    senderName: user.displayName ?? '익명',
    text,
    createdAt: serverTimestamp(),
  });
}
```

클라이언트의 길이 검사는 빠른 피드백을 주기 위한 UI 검증일 뿐이다. 사용자는 변조한 앱이나 REST API로 데이터베이스를 직접 호출할 수 있으므로 동일한 조건을 Security Rules에서도 검증해야 한다.

`set()`이 반환한 Promise가 완료되면 서버가 쓰기를 처리했다는 것을 알 수 있다. 권한 부족이나 네트워크 오류가 발생할 수 있으므로 호출하는 화면에서는 오류 상태를 사용자에게 보여주는 것이 좋다.

## 최근 메시지를 실시간으로 구독하기

메시지 전체를 구독하면 채팅 기록이 쌓일수록 최초 다운로드와 갱신 비용이 커진다. 여기서는 `createdAt` 순서로 최근 50개만 구독한다.

```ts
// src/features/chat/chatApi.ts
import {
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
} from 'firebase/database';

import { db } from '../../lib/firebase';

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number | null;
};

export function subscribeToMessages(
  roomId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
) {
  const messagesQuery = query(
    ref(db, `messages/${roomId}`),
    orderByChild('createdAt'),
    limitToLast(50),
  );

  return onValue(
    messagesQuery,
    (snapshot) => {
      const messages: ChatMessage[] = [];

      snapshot.forEach((child) => {
        messages.push({
          id: child.key!,
          ...child.val(),
        });
      });

      onMessages(messages);
    },
    onError,
  );
}
```

`onValue()`는 처음 구독할 때 현재 데이터의 스냅샷을 전달하고, 이후 쿼리 결과가 달라질 때 다시 호출된다. 반환값은 구독 해제 함수다. 화면이 사라졌는데 리스너를 그대로 두면 같은 콜백이 중복 등록되거나 불필요한 다운로드가 계속될 수 있으므로 반드시 정리해야 한다.

메시지 수가 많고 항목별 추가·수정·삭제를 세밀하게 반영해야 한다면 `onChildAdded()`, `onChildChanged()`, `onChildRemoved()`를 조합할 수 있다. 이때 `onChildAdded()`는 새 메시지만 전달하는 것이 아니라 **구독을 시작할 때 이미 존재하는 각 자식에도 한 번씩 호출**된다는 점을 기억해야 한다.

## React Native 채팅 화면 구현하기

앞에서 만든 저장 함수와 구독 함수를 React Native 화면에서 사용한다. 로그인한 Firebase `User`와 채팅방 ID를 상위 navigator 또는 screen에서 전달받는 예제다.

```tsx
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { User } from 'firebase/auth';

import {
  type ChatMessage,
  sendMessage,
  subscribeToMessages,
} from './chatApi';

type ChatRoomProps = {
  roomId: string;
  user: User;
};

export function ChatRoom({ roomId, user }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setError('');

    const unsubscribe = subscribeToMessages(
      roomId,
      setMessages,
      () => setError('메시지를 불러오지 못했습니다.'),
    );

    return unsubscribe;
  }, [roomId]);

  const handleSend = useCallback(async () => {
    if (!value.trim() || isSending) return;

    setIsSending(true);
    setError('');

    try {
      await sendMessage(roomId, user, value);
      setValue('');
    } catch {
      setError('메시지를 보내지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSending(false);
    }
  }, [isSending, roomId, user, value]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <Text style={styles.sender}>{item.senderName}</Text>
            <Text>{item.text}</Text>
            <Text style={styles.time}>
              {item.createdAt
                ? new Date(item.createdAt).toLocaleTimeString()
                : '전송 중'}
            </Text>
          </View>
        )}
      />

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={value}
          maxLength={1000}
          multiline
          placeholder="메시지"
          onChangeText={setValue}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isSending || !value.trim()}
          onPress={handleSend}
          style={styles.button}
        >
          {isSending
            ? <ActivityIndicator />
            : <Text>전송</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  message: { paddingHorizontal: 16, paddingVertical: 8 },
  sender: { fontWeight: '700' },
  time: { color: '#666', fontSize: 12 },
  error: { color: '#b00020', paddingHorizontal: 16 },
  composer: { flexDirection: 'row', padding: 12 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10 },
  button: { justifyContent: 'center', paddingHorizontal: 16 },
});
```

상대방의 메시지도 같은 경로에 저장되므로 새로고침 없이 `messages` 상태에 반영된다. 화면이 unmount되거나 `roomId`가 바뀌면 Effect의 정리 함수가 기존 listener를 해제해 중복 구독을 막는다.

실제 앱에서는 Safe Area, 키보드 높이, Android back button, 앱이 background로 이동하는 상황도 함께 처리해야 한다. 새 메시지 자동 스크롤은 사용자가 과거 기록을 읽고 있는지 확인한 뒤 적용해야 화면이 갑자기 아래로 이동하지 않는다.

## Security Rules로 채팅방 참여자만 허용하기

모바일 애플리케이션에 포함된 코드는 신뢰할 수 없다. `roomId`를 화면에서 숨기거나 전송 버튼을 비활성화해도 사용자는 데이터베이스 경로에 직접 요청할 수 있다. 따라서 읽기와 쓰기 권한은 서버에서 실행되는 Security Rules로 강제해야 한다.

다음 규칙은 기본 접근을 차단하고, 채팅방 참여자만 메시지를 읽게 한다. 새 메시지는 인증된 발신자가 자신의 UID로 작성할 때만 허용하며 필드와 길이도 검증한다.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$roomId": {
        ".read": "auth != null && data.child('members').child(auth.uid).val() === true"
      }
    },
    "messages": {
      "$roomId": {
        ".read": "auth != null && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true",
        ".indexOn": ["createdAt"],
        "$messageId": {
          ".write": "auth != null && !data.exists() && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true && newData.child('senderId').val() === auth.uid",
          ".validate": "newData.hasChildren(['senderId', 'senderName', 'text', 'createdAt'])",
          "senderId": {
            ".validate": "newData.isString() && newData.val() === auth.uid"
          },
          "senderName": {
            ".validate": "newData.isString() && newData.val() === root.child('profiles').child(auth.uid).child('displayName').val()"
          },
          "text": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 1000"
          },
          "createdAt": {
            ".validate": "newData.isNumber() && newData.val() === now"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    },
    "userRooms": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

이 예제는 채팅방 생성, 참여자 변경과 `profiles/{uid}/displayName` 변경을 클라이언트에 허용하지 않는다. 신뢰할 수 있는 서버나 Cloud Functions가 방과 검증된 프로필을 관리한다고 가정한 최소 규칙이다. 이렇게 해야 사용자가 `senderName`만 다른 사람 이름으로 바꾸는 사칭도 막을 수 있다. 클라이언트가 방이나 프로필을 생성해야 한다면 생성자 UID, 초기 참여자, 변경 가능한 필드를 별도로 검증하는 규칙을 설계해야 한다.

Rules에서 중요한 항목은 다음과 같다.

- `.read`와 `.write`는 누가 해당 경로에 접근할 수 있는지 결정한다.
- `.validate`는 허용된 쓰기의 데이터 형태와 값을 검사한다.
- `.indexOn`은 `createdAt`으로 정렬하는 쿼리를 효율적으로 처리하도록 인덱스를 선언한다.
- `auth.uid`는 Firebase Authentication으로 확인된 사용자 ID다.
- `now`는 Firebase 서버가 판단한 밀리초 단위 시각이다.

Rules는 필터가 아니다. 어떤 사용자가 하위 메시지 일부를 읽을 권한이 있다고 해서 상위 `messages` 전체를 요청하면 허용된 데이터만 골라 반환하지 않는다. **클라이언트 쿼리 경로와 Rules가 허용하는 경로를 일치시켜야 한다.**

## 온라인 상태와 마지막 접속 시각 표시하기

Realtime Database는 `/.info/connected`라는 특수 경로로 현재 클라이언트의 연결 상태를 제공한다. `onDisconnect()`를 함께 사용하면 앱 process가 종료되거나 네트워크가 끊겼을 때 서버가 접속 기록을 정리하도록 예약할 수 있다.

```ts
import {
  type DatabaseReference,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
} from 'firebase/database';

import { db } from '../../lib/firebase';

export function connectPresence(uid: string) {
  const connectedRef = ref(db, '.info/connected');
  const connectionsRef = ref(db, `presence/${uid}/connections`);
  const lastOnlineRef = ref(db, `presence/${uid}/lastOnline`);
  let currentConnectionRef: DatabaseReference | null = null;

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true) {
      return;
    }

    const connectionRef = push(connectionsRef);
    currentConnectionRef = connectionRef;

    await onDisconnect(connectionRef).remove();
    await onDisconnect(lastOnlineRef).set(serverTimestamp());
    await set(connectionRef, true);
  });

  return () => {
    unsubscribe();

    if (currentConnectionRef) {
      void onDisconnect(currentConnectionRef).cancel();
      void remove(currentConnectionRef);
    }
  };
}
```

한 사용자가 여러 기기나 앱 session에서 접속할 수 있으므로 `online: true` 하나만 저장하지 않고 연결별 자식 노드를 만든다. 연결이 하나라도 남아 있으면 온라인으로 판단하고, 모든 연결이 사라졌을 때 오프라인으로 표시할 수 있다.

`onDisconnect()` 예약은 온라인 값을 기록하기 전에 등록하는 것이 중요하다. 온라인으로 기록한 직후 네트워크가 끊기는 경쟁 상태에서도 서버가 연결 정보를 정리할 수 있기 때문이다. `presence` 경로에도 사용자가 자신의 연결 정보만 쓸 수 있도록 별도의 Rules를 추가해야 한다.

## 로컬 Emulator로 규칙 테스트하기

Security Rules는 화면에서 정상 동작하는지만 확인해서는 부족하다. 다른 사용자의 채팅방 읽기, 발신자 UID 위조, 너무 긴 메시지, 임의 필드 추가 같은 실패 조건도 테스트해야 한다.

로컬 개발 환경에서는 애플리케이션을 Realtime Database Emulator에 연결할 수 있다.

```ts
import {
  connectDatabaseEmulator,
  getDatabase,
} from 'firebase/database';
import { Platform } from 'react-native';

const db = getDatabase();

if (__DEV__) {
  const emulatorHost = Platform.OS === 'android'
    ? '10.0.2.2'
    : '127.0.0.1';

  connectDatabaseEmulator(db, emulatorHost, 9000);
}
```

Android Emulator의 `10.0.2.2`는 개발 컴퓨터의 loopback을 가리킨다. iOS Simulator는 일반적으로 `127.0.0.1`을 사용할 수 있고, 실제 기기에서는 개발 컴퓨터의 LAN IP와 방화벽 설정이 필요하다.

에뮬레이터 연결은 `getDatabase()` 직후, 다른 데이터베이스 작업보다 먼저 한 번만 실행한다. 제품 코드에서는 개발 build에서만 연결되도록 분리한다. 테스트할 항목은 다음과 같다.

1. 인증하지 않은 사용자는 메시지를 읽거나 쓸 수 없는가?
2. 채팅방에 참여하지 않은 사용자의 읽기가 거부되는가?
3. `senderId`를 다른 UID로 바꾸면 쓰기가 거부되는가?
4. 빈 문자열이나 1000자를 넘는 메시지가 거부되는가?
5. 정의하지 않은 필드를 추가하면 쓰기가 거부되는가?
6. 정상 참여자의 메시지는 저장되고 다른 참여자에게 전달되는가?

## 비용과 성능을 위해 확인할 것

실시간 리스너를 사용한다고 해서 모든 데이터를 항상 구독해야 하는 것은 아니다. Realtime Database는 경로를 읽을 때 그 아래 데이터를 함께 가져오므로 구독 위치와 데이터 구조가 다운로드 양에 직접 영향을 준다.

- 데이터베이스 루트가 아니라 필요한 채팅방의 메시지 경로를 구독한다.
- `limitToLast()`로 최초와 실시간 동기화 범위를 제한한다.
- 정렬에 사용하는 필드는 `.indexOn`으로 선언한다.
- 컴포넌트가 사라지거나 채팅방이 바뀌면 기존 구독을 해제한다.
- 이미지와 동영상은 문자열로 넣지 않고 Cloud Storage에 저장한 뒤 URL만 기록한다.
- 사용량 대시보드와 예산 알림을 설정하고, 출시 전 App Check 적용을 검토한다.

최근 50개보다 오래된 메시지를 보여주려면 위로 스크롤할 때 이전 페이지를 별도로 불러오는 방식을 추가한다. 실시간 리스너는 현재 화면에 필요한 범위에만 유지하고, 과거 기록은 페이지 단위로 읽는 편이 효율적이다.

## Realtime Database를 선택하기 좋은 경우

Realtime Database와 Cloud Firestore는 모두 클라이언트 실시간 구독을 지원하지만 데이터 모델과 쿼리 방식이 다르다. 다음과 같은 요구사항이라면 Realtime Database가 단순한 선택이 될 수 있다.

- JSON 경로 중심의 데이터 모델이 자연스럽다.
- 채팅이나 접속 상태처럼 작은 변경을 빠르게 동기화해야 한다.
- 복잡한 복합 쿼리보다 정해진 경로를 자주 읽고 쓴다.
- 연결 상태와 `onDisconnect()`를 활용해야 한다.

반대로 다양한 필드 조합의 검색과 정렬, 복잡한 문서 조회, 더 유연한 쿼리가 핵심이라면 Cloud Firestore나 별도 백엔드를 함께 비교해야 한다. 제품 이름의 차이보다 실제 조회 패턴과 권한 모델을 먼저 그려 보는 것이 중요하다.

{{< conclusion >}}
**결론:** Firebase Realtime Database에서는 `push()`로 메시지를 저장하고 제한된 쿼리를 구독하는 것만으로 실시간 채팅의 기본 흐름을 만들 수 있다. 그러나 서비스 품질을 결정하는 부분은 화면보다 데이터 구조와 Security Rules다. 채팅방 참여자 확인, 입력값 검증, 서버 시각, 인덱스, 구독 해제를 함께 설계해야 안전하고 비용을 예측할 수 있는 채팅이 된다.
{{< /conclusion >}}

## 참고 자료

- [Firebase Documentation - Supported Environments for the JavaScript SDK](https://firebase.google.com/docs/web/environments-js-sdk)
- [Firebase Documentation - Installation & Setup in JavaScript](https://firebase.google.com/docs/database/web/start)
- [Firebase Documentation - Structure Your Database](https://firebase.google.com/docs/database/web/structure-data)
- [Firebase Documentation - Read and Write Data on the Web](https://firebase.google.com/docs/database/web/read-and-write)
- [Firebase Documentation - Work with Lists of Data on the Web](https://firebase.google.com/docs/database/web/lists-of-data)
- [Firebase Documentation - Understand Realtime Database Security Rules](https://firebase.google.com/docs/database/security)
- [Firebase Documentation - Enabling Offline Capabilities in JavaScript](https://firebase.google.com/docs/database/web/offline-capabilities)
- [Firebase Documentation - Connect Your App to the Realtime Database Emulator](https://firebase.google.com/docs/emulator-suite/connect_rtdb)
- [Firebase Documentation - Optimize Database Performance](https://firebase.google.com/docs/database/usage/optimize)
