---
title: "Firebase Realtime Databaseでリアルタイムチャットを実装する"
date: 2026-08-21
draft: false
description: "Firebase Realtime Databaseの仕組みとデータ構造を理解し、React NativeとTypeScriptでリアルタイムチャットを実装しながら、Security Rules、presence、コストまで解説します。"
tags: ["Firebase", "Realtime Database", "React Native", "TypeScript", "Firebase Authentication"]
categories: ["Firebase"]
showTableOfContents: true
---

チャットでは、メッセージを保存するだけでは不十分だ。一人が送信した瞬間、同じチャットルームを見ている相手の画面にも反映されなければならない。HTTP APIだけなら新着を繰り返し問い合わせる必要があるが、Firebase Realtime Databaseはデータ変更を購読中のclientへ配信する。

この記事ではRealtime Databaseの基本動作とデータ構造を整理し、React NativeとTypeScriptで最新50件を購読するチャット画面を実装する。さらにSecurity Rules、presence、Emulator test、コストと性能まで扱う。

{{< conclusion >}}
**要点:** Realtime Databaseのチャットは、特定pathへメッセージを保存し、そのpathの変更を購読する構造である。実装は簡潔だが、実サービスではAuthenticationとSecurity Rulesでルーム参加者を検証し、queryと購読範囲を小さく保つ必要がある。
{{< /conclusion >}}

## Firebase Realtime Databaseとは

Realtime Databaseはデータをcloud上の**一つのJSON tree**として保存するNoSQL databaseだ。Relational databaseのtableとrowではなく、pathとnodeでデータを表現する。

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

Clientは`messages/room-1`のようなpathを購読できる。その場所が変更されるとSDKがsnapshotを渡し、アプリが画面stateを更新する。独自のWebSocket serverやmessage brokerを構築しなくても、リアルタイム同期を実装できる。

### HTTP pollingとの違い

| 項目 | HTTP polling | Realtime Database購読 |
| --- | --- | --- |
| 更新確認 | 一定間隔でrequest | 変更時にeventを受信 |
| リアルタイム性 | polling間隔に依存 | 接続中clientへ即時同期 |
| Server構成 | APIとstorageを構築 | Firebase SDKとmanaged DB |
| Access control | Server code | AuthenticationとSecurity Rules |
| 主な注意点 | 間隔とserver負荷 | 購読範囲、Rules、download量 |

Realtime Databaseがすべてのbackend要件を代替するわけではない。複雑な検索、relational query、serverだけで実行すべきbusiness logicが多い場合は、別backendや他のdatabaseも検討する。一方、チャット、presence、単純な通知のように小さなデータを頻繁に同期する機能には適している。

## リアルタイム同期の流れ

```text
User A ─ メッセージ保存 ─▶ messages/room-1
                                │
                                ├─ change event ─▶ User A
                                └─ change event ─▶ User B
```

1. 二人が`messages/room-1`を購読する。
2. User Aがそのpath配下へ新規メッセージを書く。
3. Realtime Databaseが書き込みを処理する。
4. 購読中clientがsnapshotを受け取り、画面を更新する。

Firebase JavaScript SDKは一時的なnetwork断でも現在の実行session内のlocal stateを利用し、再接続後にserverと同期する。ただしRealtime Databaseのデータがアプリ再起動後もdiskへ永続化されると仮定してはいけない。完全なoffline履歴が必要なら、別のlocal storageと同期方針を設計する。

並び順には端末の`Date.now()`ではなく`serverTimestamp()`を使う。端末時刻がずれていてもserver基準で整列できる。

## React Nativeプロジェクトを設定する

Firebase JavaScript SDKはReact NativeでRealtime Databaseをサポートしている。ここではExpo projectを例に、Firebase SDKとAuth stateを保持するAsyncStorageを導入する。

```bash
npm install firebase
npx expo install @react-native-async-storage/async-storage
```

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

`databaseURL`はDatabaseを作成したregionによって形式が異なるため、Firebase Consoleの値を使う。`EXPO_PUBLIC_`環境変数はapp bundleへ含まれるのでsecret storageではない。Firebaseの`apiKey`もclient appの識別情報であり、databaseを守るpasswordではない。データ保護はAuthentication、Security Rules、必要に応じてApp Checkで実施する。

`initializeAuth()`へReact Native用persistenceを指定すると、アプリ再起動後もAsyncStorageからlogin stateを復元できる。Authを複数箇所で初期化せず、一つのFirebase moduleからinstanceを共有する。

## チャットデータを設計する

ルーム情報と全メッセージを一つの深いnodeへ入れると、ルーム一覧でtitleだけが必要な場合にも大量のchild dataを取得しやすい。Realtime Databaseではquery単位と権限単位を考え、データを平坦に分ける。

```json
{
  "rooms": {
    "room-1": {
      "title": "プロジェクトチャット",
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
        "senderName": "KimJunDDo",
        "text": "こんにちは！",
        "createdAt": 1787443200000
      }
    }
  },
  "userRooms": {
    "user-a": { "room-1": true },
    "user-b": { "room-1": true }
  }
}
```

| Path | 役割 |
| --- | --- |
| `rooms/{roomId}` | Titleとmemberを保存 |
| `messages/{roomId}` | ルーム別messageを保存 |
| `userRooms/{uid}` | Userが参加するroom IDを取得 |

`userRooms`は重複データだが、全`rooms`をdownloadせずに自分のroomを取得できる。Realtime Databaseではqueryを小さく単純にするためdenormalizationを使うことが多い。複数pathを同時に変更する場合はmulti-location `update()`でatomicに反映する。

## メッセージを保存する

Message IDはclientで単純に連番を作らず、`push()`で衝突しにくいunique keyを生成する。

```ts
import type { User } from 'firebase/auth';
import { push, ref, serverTimestamp, set } from 'firebase/database';

import { db } from '../../lib/firebase';

export async function sendMessage(
  roomId: string,
  user: User,
  value: string,
) {
  const text = value.trim();

  if (!text || text.length > 1000) {
    throw new Error('メッセージは1〜1000文字で入力してください。');
  }

  const messageRef = push(ref(db, `messages/${roomId}`));

  await set(messageRef, {
    senderId: user.uid,
    senderName: user.displayName ?? '匿名',
    text,
    createdAt: serverTimestamp(),
  });
}
```

Client側の文字数確認はUI feedbackにすぎない。改変したappやREST APIから直接書き込めるため、同じ条件をSecurity Rulesでも検証する。`set()`はpermission deniedやnetwork errorで失敗し得るので、画面側で送信中とerror stateを表示する。

## 最新50件を購読する

履歴全体を購読すると、メッセージが増えるほど初回download量と更新costが大きくなる。`createdAt`順で最新50件に限定する。

```ts
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
        messages.push({ id: child.key!, ...child.val() });
      });

      onMessages(messages);
    },
    onError,
  );
}
```

`onValue()`は購読開始時に現在のsnapshotを一度返し、その後query結果が変わるたびに呼ばれる。戻り値はunsubscribe functionなので、screenを離れるときに必ず実行する。

項目単位の追加・更新・削除を扱う場合は`onChildAdded()`、`onChildChanged()`、`onChildRemoved()`を組み合わせられる。ただし`onChildAdded()`は新着だけでなく、購読開始時に既存の各childにも一度ずつ発火する。

## React Nativeチャット画面

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

type Props = { roomId: string; user: User };

export function ChatRoom({ roomId, user }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setError('');
    return subscribeToMessages(
      roomId,
      setMessages,
      () => setError('メッセージを読み込めませんでした。'),
    );
  }, [roomId]);

  const handleSend = useCallback(async () => {
    if (!value.trim() || isSending) return;

    setIsSending(true);
    setError('');

    try {
      await sendMessage(roomId, user, value);
      setValue('');
    } catch {
      setError('送信できませんでした。もう一度お試しください。');
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
                : '送信中'}
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
          placeholder="メッセージ"
          onChangeText={setValue}
        />
        <Pressable
          accessibilityRole="button"
          disabled={isSending || !value.trim()}
          onPress={handleSend}
          style={styles.button}
        >
          {isSending ? <ActivityIndicator /> : <Text>送信</Text>}
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

Screenのunmountまたは`roomId`変更時にEffect cleanupがlistenerを解除する。実際のappではSafe Area、keyboard height、Android back button、background遷移も扱う。自動scrollは利用者が過去ログを読んでいない場合だけ実行する。

## Security Rulesで参加者だけを許可する

Mobile app bundleに含まれるcodeは信頼できない。UIで`roomId`を隠しても、利用者はdatabase pathへ直接requestできる。読み書きの権限はFirebase server上のSecurity Rulesで強制する。

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

この例はroom、member、`profiles/{uid}/displayName`を信頼できるserverまたはCloud Functionsが管理する前提だ。`senderName`もprofileと一致させ、他人の名前を送るspoofingを防ぐ。Clientにroom作成を許可する場合はcreator UID、初期member、変更可能fieldを別途検証する。

- `.read`と`.write`はaccess権限を決める。
- `.validate`は許可済みwriteのdata shapeと値を検証する。
- `.indexOn`は`createdAt` query用indexを宣言する。
- `auth.uid`はAuthenticationで確認されたuser IDである。
- `now`はFirebase server時刻のmillisecond値である。

Rulesはfilterではない。Parent pathを読むと、許可されたchildだけを選んで返すのではなくrequest全体が拒否される。Clientのquery pathとRulesの許可pathを一致させる。

## Presenceと最終接続時刻

Realtime Databaseは`/.info/connected`で現在clientの接続状態を提供する。`onDisconnect()`を先に予約すると、app process終了やnetwork断の際にserverがconnection recordを整理できる。

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
  let currentRef: DatabaseReference | null = null;

  const unsubscribe = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() !== true) return;

    const connectionRef = push(connectionsRef);
    currentRef = connectionRef;

    await onDisconnect(connectionRef).remove();
    await onDisconnect(lastOnlineRef).set(serverTimestamp());
    await set(connectionRef, true);
  });

  return () => {
    unsubscribe();
    if (currentRef) {
      void onDisconnect(currentRef).cancel();
      void remove(currentRef);
    }
  };
}
```

一人が複数端末や複数app sessionから接続できるため、`online: true`一つではなくconnectionごとのchildを保存する。Onlineを書き込む前に`onDisconnect()`を登録し、途中で接続が切れるrace conditionを避ける。`presence`にも本人だけが書けるRulesが必要だ。

## Local EmulatorでRulesをテストする

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

Android Emulatorでは`10.0.2.2`が開発computerのloopbackを指す。iOS Simulatorは通常`127.0.0.1`を使える。実機では開発computerのLAN IPとfirewall設定が必要だ。Emulator接続は`getDatabase()`直後、他のDB操作より前に一度だけ行い、development buildに限定する。

最低限、次を検証する。

1. 未認証userはmessageを読み書きできないか。
2. 非参加者のroom readが拒否されるか。
3. `senderId`や`senderName`を偽装すると拒否されるか。
4. 空文字または1000文字超のmessageが拒否されるか。
5. 定義外fieldを追加すると拒否されるか。
6. 正常な参加者のmessageが保存され、相手へ届くか。

## コストと性能

- Database rootではなく、必要な`messages/{roomId}`だけを購読する。
- `limitToLast()`で初回同期とリアルタイム範囲を制限する。
- Sort fieldを`.indexOn`へ登録する。
- Screen unmountやroom変更時にlistenerを解除する。
- 画像・動画を文字列で保存せずCloud Storageへ置き、URLだけをDBへ保存する。
- Usage dashboardとbudget alertを設定し、release前にApp Checkも検討する。

50件より古い履歴は上scroll時に別pageとして取得する。Realtime listenerは現在画面に必要な範囲だけ維持し、過去ログを無制限に購読しない。

## Realtime Databaseが適する場合

- JSON path中心のmodelが自然である。
- Chatやpresenceの小さな変更を高速に同期したい。
- 複雑なcompound queryより決まったpathを頻繁に読み書きする。
- `/.info/connected`と`onDisconnect()`を活用したい。

多様なfield組み合わせの検索・並び替え、複雑なdocument queryが中心ならCloud Firestoreや独自backendも比較する。製品名ではなく、実際のread patternとauthorization modelを先に設計する。

{{< conclusion >}}
**結論:** Firebase Realtime Databaseでは、`push()`でmessageを書き、制限付きqueryを購読することでReact Nativeチャットの基本を作れる。しかし品質を決めるのは画面よりdata structureとSecurity Rulesである。Room memberの確認、sender偽装防止、入力検証、server timestamp、index、unsubscribe、Emulator testまで一緒に設計して初めて、安全でコストを予測できるチャットになる。
{{< /conclusion >}}

## 参考資料

- [Firebase - Supported environments for the JavaScript SDK](https://firebase.google.com/docs/web/environments-js-sdk)
- [Firebase - Installation and setup in JavaScript](https://firebase.google.com/docs/database/web/start)
- [Firebase - Structure your database](https://firebase.google.com/docs/database/web/structure-data)
- [Firebase - Read and write data](https://firebase.google.com/docs/database/web/read-and-write)
- [Firebase - Work with lists of data](https://firebase.google.com/docs/database/web/lists-of-data)
- [Firebase - Understand Realtime Database Security Rules](https://firebase.google.com/docs/database/security)
- [Firebase - Offline capabilities and presence](https://firebase.google.com/docs/database/web/offline-capabilities)
- [Firebase - Connect to the Realtime Database Emulator](https://firebase.google.com/docs/emulator-suite/connect_rtdb)
- [Firebase - Optimize database performance](https://firebase.google.com/docs/database/usage/optimize)
