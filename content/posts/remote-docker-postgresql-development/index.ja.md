---
title: "リモートPCのDocker PostgreSQLを開発DBとして利用する"
date: 2026-08-24
draft: false
description: "開発PCでMyGomiバックエンドを実行し、大阪のPCではDocker PostgreSQLだけをリモートDBとして運用した構成と、Compose、Volume、ネットワーク、Flyway、セキュリティ、バックアップを解説します。"
tags: ["Docker", "PostgreSQL", "Spring Boot", "Flyway", "Remote Database"]
categories: ["DevOps"]
showTableOfContents: true
---

MyGomiバックエンドのソースコードとSpring Bootアプリケーションは、開発者が使うコンピューターに置かれていた。大阪にある別のコンピューターではアプリケーションを動かさず、DockerでPostgreSQLコンテナだけを起動し、開発用のリモートDBとして利用した。

一見すると「PostgreSQLをDockerで動かした」だけに見える。しかし実際には、二台のコンピューター、Docker Engine、PostgreSQLコンテナ、公開ポート、Volume、Spring Bootの環境変数、Flyway migrationが一つの経路でつながっている。この境界を理解していないと、接続エラーがアプリケーション、ネットワーク、Docker、DBのどこで起きているかを判断できない。

{{< conclusion >}}
**大阪のコンピューターはリモートDBホストであり、ソースコードやSpring Bootの実行サーバーではない。** 開発コンピューター上のSpring Bootがネットワーク経由でDocker PostgreSQLへ接続し、Docker Volumeがデータを保持する。接続後はアプリケーションのFlywayがschema versionを管理するため、コンテナだけでなく接続経路、firewall、ポート公開範囲、バックアップも合わせて設計する必要がある。
{{< /conclusion >}}

> 当時利用したComposeファイルとネットワーク設定は現在のリポジトリに残っていない。本記事では「大阪のコンピューターではDocker PostgreSQLだけを実行した」という確認済みの構成と、同じ環境を安全に再現するための推奨例を区別して説明する。

## 全体構成

```text
開発コンピューター
    ├─ プロジェクトのソースコード
    └─ Spring Bootアプリケーション
              │
              │ PostgreSQL接続
              │ （許可されたネットワークまたはSSH tunnel）
              ▼
大阪のコンピューター
    └─ Docker Engine
         └─ PostgreSQLコンテナ
              └─ Docker Volumeへデータ保存
```

Spring BootとPostgreSQLは別のコンピューターで動作する。したがって通信は大阪のコンピューター内部だけでは完結しない。開発コンピューターから大阪ホストの公開ポートへ接続するか、SSH tunnelで大阪ホストのloopbackポートへ転送する必要がある。

この構成の利点は次のとおりだ。

- 開発コンピューターを変更しても同じDBとテストデータを利用できる。
- PostgreSQLを各開発コンピューターへ直接インストールしなくてよい。
- DBのライフサイクルをSpring Bootの起動・終了から分離できる。
- PostgreSQLのversionとデータ保存場所をDocker設定で管理できる。

一方、大阪のコンピューターの電源、双方のネットワーク、firewall、Docker、PostgreSQLのいずれかに問題が起きるとDBへ接続できない。ローカルDBと比べてnetwork latencyも加わる。

## Dockerの基本

Dockerはアプリケーションとその実行環境をcontainer単位で管理する。PostgreSQLの場合、OSへpackageを直接インストールする代わりに、PostgreSQLが準備されたimageを取得して隔離されたprocessとして実行できる。

### Image

Imageはcontainerを作るためのread-only templateだ。PostgreSQLの実行ファイル、基本設定、directory構造などが含まれる。

```text
postgres:16
```

`postgres`がimage名、`16`がtagである。`latest`だけに依存すると、別の時点に異なるmajor versionを取得する可能性があるため、プロジェクトではversionを明示する。

### Container

Containerはimageを実際に実行したinstanceだ。同じimageから開発用とテスト用のcontainerを別々に作れる。

```text
PostgreSQL image ──実行──> mygomi-postgres container
```

`stop`は実行を止め、`start`は停止済みcontainerを再開する。`docker compose down`はComposeが作成したcontainerとnetworkを削除する。containerの削除とDBデータの削除が同じかどうかはVolume設定によって決まる。

### Virtual Machineとの違い

| 項目 | Virtual Machine | Container |
| --- | --- | --- |
| 実行単位 | Guest OSを含むVM | 隔離されたprocess |
| サイズ | 比較的大きい | 比較的小さい |
| 起動 | OSのbootが必要 | 一般に速い |
| 隔離 | Hardware virtualization | Host kernelを共有 |

ContainerをVMと同じsecurity boundaryだと考えてはいけない。imageの出所、container権限、host OSとDocker Engineの更新も重要だ。

## PostgreSQLにDockerを使った理由

### 導入手順を揃える

OSへ直接インストールすると、package、service名、設定場所が環境ごとに異なる。Dockerではimage、環境変数、port、Volumeを同じ形式で定義できる。

### Versionを固定する

Composeへ`postgres:16`と記録すれば、別のhostでも同じmajor versionを再現しやすい。

### 他のプロジェクトと分離する

別のプロジェクトが異なるPostgreSQL versionやDB名を使っても、container、port、Volumeを分けて衝突を減らせる。

### 実行方法を文書化する

長い`docker run`をterminal historyだけに残さず、Composeでimage、環境変数、Volume、health checkを管理すれば、DB環境そのものがversion管理可能な文書になる。

## Port publishingを正しく理解する

PostgreSQLはcontainer内部で通常`5432`を使う。別のコンピューターのSpring Bootから接続するには、大阪ホストのportとcontainer portを対応付ける必要がある。

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

```text
host address : host port : container port
```

`127.0.0.1:5432:5432`なら、大阪コンピューター自身だけが公開portへ接続できる。開発コンピューターから直接は届かないため、後述するSSH tunnelを使う。

```yaml
ports:
  - "5432:5432"
```

host addressを省略すると、基本的にhostのすべてのaddressへpublishされ、外部から到達できる範囲が広がる。リモートDBだからといってPostgreSQLをinternet全体へ公開する必要はない。

推奨方法は次のいずれかだ。

1. `127.0.0.1`へだけpublishし、SSH tunnelで接続する。
2. VPNまたはprivate network interfaceへだけbindする。
3. やむを得ず直接公開する場合、firewallで開発コンピューターのIPだけを許可し、PostgreSQLの`listen_addresses`、`pg_hba.conf`、TLSも確認する。

## Volumeでデータを保持する

Containerの書き込み可能なfilesystemはcontainerのlifecycleに結び付く。containerを作り直してもDBを残すには、PostgreSQL data directoryをnamed volumeへ接続する。

```yaml
volumes:
  - mygomi-postgres-data:/var/lib/postgresql/data
```

```text
PostgreSQL container
    └─ /var/lib/postgresql/data
                  │
                  ▼
        mygomi-postgres-data volume
```

同じVolumeを新しいcontainerへ接続すれば既存データを再利用できる。ただしVolumeはbackupではない。host diskの障害や誤削除には耐えられないため、別のdumpが必要になる。

## 環境変数と秘密情報

PostgreSQL official imageは初回初期化に環境変数を使う。

```yaml
environment:
  POSTGRES_DB: mygomi_db
  POSTGRES_USER: ${DB_USERNAME}
  POSTGRES_PASSWORD: ${DB_PASSWORD}
```

PasswordをComposeへ直接書かず、`.env`またはhostの環境変数から渡す。

```dotenv
DB_USERNAME=example_user
DB_PASSWORD=replace-with-a-strong-password
```

`.env`は`.gitignore`へ追加する。過去にGitへ登録したcredentialはファイルから消すだけでは無効にならないため、値自体をrotateする。

## Docker ComposeでDBを構成する

次は大阪コンピューターのloopbackへだけPostgreSQLをpublishし、SSH tunnelで利用する再現例だ。

```yaml
services:
  postgres:
    image: postgres:16
    container_name: mygomi-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: mygomi_db
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      TZ: Asia/Tokyo
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - mygomi-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d mygomi_db"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  mygomi-postgres-data:
```

主な設定は次のとおりだ。

| 設定 | 意味 |
| --- | --- |
| `image` | PostgreSQL imageとversion |
| `restart` | Docker再起動後の再実行方針 |
| `environment` | 初期DB、user、password |
| `ports` | host portとcontainer portの対応 |
| `volumes` | DBデータの永続化 |
| `healthcheck` | PostgreSQLが接続を受けられるか確認 |

大阪コンピューターで実行する。

```bash
docker compose up -d
docker compose ps
docker compose logs -f postgres
```

DBのready状態とCLI接続は次のように確認できる。

```bash
docker compose exec postgres \
  pg_isready -U example_user -d mygomi_db

docker compose exec postgres \
  psql -U example_user -d mygomi_db
```

```bash
docker compose down
```

`docker compose down -v`はnamed volumeまで削除するため、DB初期化が明確な目的である場合にだけ使う。

## Docker networkと今回の構成

同じCompose network内のcontainer同士ならservice名で接続できる。

```text
backend container ── postgres:5432 ──> postgres container
```

しかしMyGomiのSpring Bootは大阪のDocker network内に存在しない。開発コンピューターからはCompose service名`postgres`を解決できないため、次のどちらかを利用する。

```text
直接接続:
Spring Boot ── osaka-db-host:5432 ──> Docker PostgreSQL

SSH tunnel:
Spring Boot ── localhost:15432
                     │
                     └─ SSH ──> Osaka 127.0.0.1:5432 ──> Docker PostgreSQL
```

## Spring Bootから接続する

MyGomiは接続情報を環境変数から受け取る。

```properties
spring.datasource.url=jdbc:postgresql://${DB_URL}/mygomi_db
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver
```

`DB_URL`はJDBC URL全体ではなく、hostとportの部分である。

直接接続する場合は、許可された大阪ホストの名前またはprivate IPを指定する。

```bash
export DB_URL=osaka-db-host:5432
export DB_USERNAME=example_user
export DB_PASSWORD=replace-with-a-strong-password
./gradlew bootRun
```

完成するURLは`jdbc:postgresql://osaka-db-host:5432/mygomi_db`となる。

## SSH tunnelを使う

PostgreSQL 5432をinternetへ公開せず、開発コンピューターからSSH local port forwardingを作る。

```bash
ssh -L 15432:127.0.0.1:5432 remote-user@osaka-host
```

SSH接続中、開発コンピューターの`127.0.0.1:15432`へ送ったtrafficが大阪コンピューターの`127.0.0.1:5432`へ暗号化されて転送される。

```text
Spring Boot / DB GUI
127.0.0.1:15432
        │
        │ SSH encrypted tunnel
        ▼
大阪 127.0.0.1:5432
        │
        ▼
PostgreSQL container
```

別terminalでアプリケーションを起動する。

```bash
export DB_URL=localhost:15432
export DB_USERNAME=example_user
export DB_PASSWORD=replace-with-a-strong-password
./gradlew bootRun
```

ここで`localhost`はDBが開発コンピューターにあるという意味ではない。local portをSSHが大阪へ転送しているため、アプリケーションからはlocal addressに見えるだけだ。

Tunnelが切れると既存のDB connectionも失われる。Connection poolが再接続を試みても、tunnelが復旧するまで新しいconnectionは作れない。

## JPAとFlywayの役割

```properties
spring.jpa.hibernate.ddl-auto=validate

spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=1
```

`ddl-auto=validate`はentityと実DB schemaの互換性を検査するが、tableを自動変更しない。Schema変更はFlyway migration SQLとして残す。

アプリケーション起動時の流れは次のとおりだ。

```text
大阪のPostgreSQL containerがready
        ↓
開発コンピューターでSpring Boot起動
        ↓
networkまたはSSH tunnelでDB接続
        ↓
Flywayがschema historyを確認
        ↓
未適用migrationを実行
        ↓
Hibernateがentityとschemaをvalidate
        ↓
アプリケーション起動完了
```

一度共有されたmigrationを後から編集すると、別環境のchecksumと一致しなくなる。既存ファイルを変更せず、新しいversionのmigrationを追加する。

## リモートDBの長所と短所

### 長所

- 開発コンピューターを変更してもDBとテストデータを維持できる。
- DBの起動時間をSpring Bootの実行から分離できる。
- 各開発者がPostgreSQLを直接インストールしなくてよい。
- ImageとComposeでDB versionと構成を揃えられる。
- 許可されたチームメンバーが同じ開発DBを利用できる。

### 短所

- InternetまたはSSH tunnelが切れるとDB connectionも切れる。
- 大阪コンピューターやDocker daemonが停止すると利用できない。
- Local DBよりnetwork latencyが増える。
- 共有DBではtest dataやmigrationが衝突する可能性がある。
- Port、account、firewallの管理を誤るとsecurity riskが大きい。

開発者ごとの隔離が必要なら、Compose project name、Volume、host portを分けるか、用途別DBを作る。

## データ永続化とバックアップ

```text
Image: PostgreSQL実行環境
Container: 現在動作中のPostgreSQL process
Volume: 実際のDB file
Migration: DB構造の変更履歴
Backup: 障害復旧用の別コピー
```

Flywayは空のDBにschemaを再構築できるが、利用者が作成した投稿、チャット、accountなどのデータは復元しない。Volumeとは別に論理backupを作る。

### Backup

大阪コンピューターでcustom archiveを作成する。

```bash
docker compose exec -T postgres \
  pg_dump -U example_user -d mygomi_db -Fc \
  > mygomi_db.dump
```

Backup fileを同じhostだけに置かず、アクセス制限と必要な暗号化を行って別の安全なstorageへコピーする。

### Restore

```bash
docker compose exec -T postgres \
  pg_restore -U example_user -d mygomi_db \
  --clean --if-exists < mygomi_db.dump
```

`--clean`は既存objectを削除し得るため、対象DBを確認してから実行する。Backupは作成logだけで判断せず、別のtest DBへ定期的にrestoreして利用可能か検証する。

## 接続できないときの確認順序

### 1. 大阪コンピューターへ到達できるか

電源、internet、VPNまたはSSH接続を確認する。ここで失敗しているならSpringやPostgreSQL設定の問題ではない。

### 2. Docker daemonは動作しているか

```bash
docker info
```

### 3. Containerは起動しているか

```bash
docker compose ps
docker compose logs postgres
```

### 4. PostgreSQLはreadyか

```bash
docker compose exec postgres \
  pg_isready -U example_user -d mygomi_db
```

Containerが`running`であることと、PostgreSQLが接続を受けられることは別である。

### 5. Hostnameとportは正しいか

- 直接接続なら`osaka-db-host:5432`など許可されたhost addressを使う。
- SSH tunnelなら開発コンピューターで`localhost:15432`を使う。
- DBを`127.0.0.1`へだけpublishした場合、別のPCから大阪hostの5432へ直接接続できない。

### 6. 環境変数は渡されているか

`DB_URL`、`DB_USERNAME`、`DB_PASSWORD`を確認する。Terminalで設定した環境変数がIDEのRun Configurationへ自動で渡らない場合もある。Password自体をlogへ出力してはいけない。

### 7. FlywayまたはJPAで失敗していないか

DB接続後に起動が止まる場合、Flyway checksum、migration SQL、entityとschemaの不一致を確認する。Network errorとschema errorを区別する。

## 運用とセキュリティ

### PostgreSQLを不用意に公開しない

可能ならloopback、VPN、private networkだけで利用する。直接公開が必要なら許可IP、`listen_addresses`、`pg_hba.conf`、TLSを設定する。

### SecretをGitから分離する

DB password、JWT signing key、API key、SSH private keyをcommitしない。本番ではSecret Managerやdeployment systemのsecret機能を使う。既に公開された値はrotateする。

### 最小権限のDB userを使う

アプリケーションをPostgreSQL superuserで接続しない。Application、migration、backup、管理の役割を必要に応じて分離する。

### Versionとupdate方針を決める

PostgreSQL major versionを固定し、minor updateとsecurity patchを適用する。Major upgradeでは単にimage tagを変えず、公式upgrade手順とextension互換性を確認する。

### Monitoringする

Disk不足はDB障害に直結する。Container statusだけでなくVolume容量、connection数、slow query、backupの成否を監視する。

開発DBを動かすコンピューターをそのまま本番DBとして扱ってはいけない。本番環境ではaccess control、deployment、log、backup、障害対応、個人情報保護を別途設計する。

## 再現可能な構成にする

```text
mygomi-backend/
├─ infra/
│  └─ compose.yaml
├─ .env.example
├─ .gitignore
├─ README.md
├─ build.gradle
└─ src/main/resources/
   ├─ application.properties
   └─ db/migration/
```

Composeファイルは大阪コンピューターへ配置してそこで実行するが、Spring Bootの全ソースを大阪へ置く必要はない。

```dotenv
DB_URL=localhost:15432
DB_USERNAME=change-me
DB_PASSWORD=change-me
```

READMEには次の順序を記録する。

1. DockerとJavaのversionを確認する。
2. 実際のsecretをGit外で設定する。
3. 大阪コンピューターで`docker compose up -d`を実行する。
4. PostgreSQL health checkを確認する。
5. 開発コンピューターでSSH tunnelまたは許可されたnetwork接続を準備する。
6. 開発コンピューターで`./gradlew bootRun`を実行する。
7. Flyway migrationの成功を確認する。
8. Tunnel、container、Volume、backupの終了・保存方針を確認する。

## まとめ

1. ソースコードとSpring Bootは開発コンピューターで実行する。
2. 大阪コンピューターではDocker PostgreSQLだけを実行する。
3. Port publishingとSSH tunnelまたはprivate networkで二台を接続する。
4. Docker Volumeでcontainer再作成後もDB fileを保持する。
5. 環境変数で接続先とcredentialをコードから分離する。
6. Flywayでschema変更履歴を管理し、JPA `validate`で整合性を検査する。
7. 共有DBの同時変更とnetwork断を前提に障害を切り分ける。
8. Volumeとは別にdumpとrestore testを運用する。

{{< conclusion >}}
**結論:** MyGomiのソースコードとSpring Bootは開発コンピューターにあり、大阪コンピューターはDocker PostgreSQLだけを提供するリモートDBホストだった。この分離はDBの導入とversion管理を簡単にする一方、network断とsecurityという新しい条件を生む。Port公開範囲、SSH tunnelまたはprivate network、Volume、環境変数、Flyway、独立したbackupを合わせて設計して初めて、再現可能で安全な開発環境になる。
{{< /conclusion >}}

## 参考資料

- [Docker Docs - What is Docker?](https://docs.docker.com/get-started/docker-overview/)
- [Docker Docs - Port publishing and mapping](https://docs.docker.com/engine/network/port-publishing/)
- [Docker Docs - Networking in Compose](https://docs.docker.com/compose/how-tos/networking/)
- [Docker Docs - Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Docker Hub - PostgreSQL Official Image](https://hub.docker.com/_/postgres)
- [PostgreSQL Documentation - Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- [Spring Boot Reference - SQL Databases](https://docs.spring.io/spring-boot/reference/data/sql.html)
- [Flyway Documentation](https://documentation.red-gate.com/flyway)
