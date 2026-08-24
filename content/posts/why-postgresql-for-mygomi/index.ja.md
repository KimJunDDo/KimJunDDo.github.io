---
title: "MyGomiでPostgreSQLを選んだ理由"
date: 2026-08-24T23:00:00+09:00
draft: false
description: "MyGomiのリレーショナルデータ、予約トランザクション、位置検索、整合性要件を基にPostgreSQLを選択した理由と、主要なデータベースとの違いを整理します。"
tags: ["PostgreSQL", "Database", "Spring Boot", "JPA", "Flyway", "SQL"]
categories: ["Database"]
showTableOfContents: true
---

MyGomiバックエンドの主データベースにはPostgreSQLを使用した。「よく使われているから」「無料だから」という理由だけでなく、プロジェクトのデータ構造と機能を確認すると、PostgreSQLを選ぶ具体的な根拠がある。

MyGomiにはユーザー、住所、地域別のごみ収集ルール、品目、譲渡投稿、画像、チャットルーム、メッセージ、予約同意、通報データが存在する。これらは独立したデータではなく、IDとステータスによって密接に結び付いている。特に2人の予約同意によって投稿ステータスを変更する処理では、リレーションとトランザクションが重要になる。

{{< conclusion >}}
**MyGomiでPostgreSQLを選んだ最大の理由は、データの関係と整合性が中心だからである。** 外部キー、UNIQUE制約、CHECK制約によって不正な状態をDB側でも防ぎ、予約や通報に伴う複数の操作をトランザクションとして処理できる。複合クエリ、位置計算、部分インデックス、FlywayとSpring Data JPAの組み合わせも要件に合っていた。
{{< /conclusion >}}

この記事ではデータベースの種類を整理し、MyGomiの実際のスキーマと処理を基にPostgreSQLを選択した理由を説明する。他製品を否定するのではなく、どの要件にどの特徴が対応したかを明確にする。

## データベース選定で確認すること

データベース選定は単純な性能順位ではない。同じ製品でもデータモデル、クエリ、運用方法によって適性は変わる。

- データ間の関係はどれほど複雑か。
- 複数データを一度に整合性を保って変更する必要があるか。
- どの条件で絞り込み、並べ替え、集計を行うか。
- スキーマは柔軟であるべきか、明確に固定されるべきか。
- 読み込みと書き込みの比率はどうか。
- 単一サーバーから始めるか、複数リージョンへ分散するか。
- 位置、検索、キャッシュ、分析などの特殊機能が必要か。
- チームがバックアップ、復元、監視、障害対応を運用できるか。

「NoSQLは速くSQLは遅い」「PostgreSQLが常に最善」のような一文だけでは判断できない。一つのサービスで複数のデータベースを役割ごとに使う場合もある。

## Databaseの主な種類

| 種類 | 代表製品 | Data model | 適した処理 |
| --- | --- | --- | --- |
| Relational DB | PostgreSQL, MySQL, MariaDB, SQLite | Tableとrelation | 会員、予約、決済、業務data |
| Document DB | MongoDB, Couchbase | JSONに近いdocument | 柔軟なschema、document単位data |
| Key-Value DB | Redis, DynamoDB | Keyとvalue | Cache、session、counter |
| Wide-column DB | Cassandra, HBase | Partition中心column | 大規模分散write、event data |
| Graph DB | Neo4j | Nodeとedge | Relation探索、recommendation |
| Time-series DB | TimescaleDB, InfluxDB | 時間中心record | Sensor、metric、monitoring |
| Search engine | Elasticsearch, OpenSearch | Inverted index | Full-text search、log検索 |

Redisやsearch engineもデータを保存するが、transactionalな業務データのsource of truthではなく、relational DBを補完する用途で使われることが多い。

## Relational Databaseとは

Relational DBはデータをrowとcolumnからなるtableへ保存し、primary keyとforeign keyでrelationを表現する。

MyGomiの一部relationを単純化すると次のようになる。

```text
User ──< UserAddress >── Area ──< CollectionRule
  │
  ├──< SharePost ──< SharePostImage
  │       │
  │       ├──< ChatRoom ──< ChatMessage
  │       │        └──< ReservationAgreement
  │       └──< Report
  │
  └──< UserKeywordPreference
```

1人のユーザーは複数の住所と投稿を持ち、1件の投稿には複数の画像とチャットルームがつながる。チャットルームには投稿者、申請者、メッセージ、予約同意が関連する。

### 長所

- Primary key、foreign key、UNIQUE、CHECKで整合性を守りやすい。
- 複数の変更を一つのtransactionへまとめられる。
- JOIN、aggregate、sort、paginationなどの複合queryが強い。
- Schemaによってdata構造と意味を把握しやすい。
- SQLと管理toolのecosystemが広い。

### 短所

- Schema変更にはmigration管理が必要になる。
- Relationが増えるとquery設計とoptimizationが複雑になる。
- 単純cacheには専用Key-Value DBより重い場合がある。
- Horizontal scalingはtransaction境界によって難しくなる。

MyGomiにはuser、post、roomのように構造が明確なデータが多いため、relational modelが自然だった。

## PostgreSQLの特徴

PostgreSQLはopen sourceのobject-relational database management systemで、標準SQLとACID transactionに加え、JSON、array、full-text search、extension、多様なindexを提供する。

### 長所

- 複雑なSQL、JOIN、subquery、aggregateに強い。
- MVCCを利用してconcurrent read/writeを処理する。
- Foreign key、CHECK、UNIQUE、exclusion constraintが豊富である。
- Partial、expression、GIN、GiSTなど多様なindexを使える。
- `JSONB`でrelational dataとdocument dataを組み合わせられる。
- PostGISを導入すればspatial dataとradius searchを拡張できる。
- Window function、CTE、recursive queryを利用できる。
- Official Docker imageとSpring ecosystemが安定している。

### 短所とtrade-off

- SQLiteのようなembedded DBよりinstallと運用が複雑である。
- Connection数が増えるとpool管理が重要になる。
- Backup、replication、vacuum、index、slow queryへの理解が必要である。
- PostgreSQL固有のSQLを多用すると他DBへのmigration costが上がる。
- Cacheや短期dataにはRedisなどの専用storeが適する場合がある。

MyGomiは`BIGSERIAL`、PL/pgSQL trigger、partial indexを使用している。これはPostgreSQLの利点を活用している一方、他DBへ移す際のcostにもなる。

## MyGomiにPostgreSQLが合う理由

### Relationが明確である

一つの譲渡投稿には複数の申請者が別々のchat roomを作れる。各roomには二人のparticipant、複数message、予約同意がつながる。

```java
@Entity
public class ChatRoom {
    @ManyToOne(fetch = FetchType.LAZY)
    private SharePost sharePost;

    @ManyToOne(fetch = FetchType.LAZY)
    private User buyer;

    @ManyToOne(fetch = FetchType.LAZY)
    private User seller;
}
```

```java
@Entity
public class ChatMessage {
    @ManyToOne(fetch = FetchType.LAZY)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    private User sender;

    private String message;
}
```

Foreign keyを使えば、messageがどのroomに属し誰が送信したかをDBでも保証できる。Userやpostを削除する際の`RESTRICT`、`CASCADE`、soft delete方針も明示できる。

### Business ruleをconstraintで守る

Service codeのvalidationだけでは、同時requestや管理toolからの変更を完全には防げない。重要なruleはDB constraintでも保護する。

Emailの重複を防ぐ。

```sql
email VARCHAR(255) NOT NULL UNIQUE
```

同じapplicantが同じpostへroomを重複作成できないようにする。

```sql
CONSTRAINT uq_chat_room_share_post_buyer
UNIQUE (share_post_id, buyer_id)
```

同じuserが同じroomで二度同意できないようにする。

```sql
CONSTRAINT uq_chat_room_user
UNIQUE (chat_room_id, user_id)
```

Post statusを許可値に限定する。

```sql
CONSTRAINT chk_share_posts_status
CHECK (status IN ('OPEN', 'RESERVED', 'COMPLETED', 'DELETED'))
```

View countが負数になることも防ぐ。

```sql
CONSTRAINT chk_share_posts_view_count
CHECK (view_count >= 0)
```

Applicationで読みやすいerrorを先に返し、DB constraintをrace conditionまで含めた最後の防御線にする。

### 予約処理にtransactionが必要である

予約同意は一行を追加するだけではない。

1. Userがchat room participantか確認する。
2. Postが`OPEN`か確認する。
3. Userのagreementを保存する。
4. 二人とも同意したか確認する。
5. 二件揃えばpostを`RESERVED`へ変更する。

```java
@Transactional
public ReservationStatusResponseDto agree(
        Long postId,
        Long roomId,
        Long currentUserId) {
    // roomとparticipantの確認
    // agreement保存
    // 双方同意の確認
    // postをRESERVEDへ変更
}
```

途中で失敗した場合、agreementだけ、またはstatusだけが残ってはいけない。Transactionで全体をcommitまたはrollbackする。

PostgreSQLだけがtransactionを提供するわけではない。MySQL InnoDB、MariaDB、MongoDBにもtransaction機能がある。MyGomiでは複数relationと一貫したstatus transitionが中心なので、transactionとconstraintを自然に組み合わせられるDBが適していた。

### JOINと条件queryが多い

Chat room一覧は、userがbuyerまたはsellerとして参加するroomを探し、相手とpost情報を同時に読む。

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

Report管理ではtypeとstatusでfilterし、post別件数をaggregateする。

```sql
SELECT target_post_id, COUNT(*)
FROM reports
WHERE type = 'SHARE_POST'
  AND status IN ('PENDING', 'IN_REVIEW')
GROUP BY target_post_id;
```

地域、category、status、created timeを組み合わせるqueryも多い。JOIN、`COUNT`、`GROUP BY`、paginationを一つの言語で表現できるSQLが合っている。

### 位置検索を拡張できる

現在のMyGomiはlatitudeとlongitudeを`DOUBLE PRECISION`で保存し、Haversine formulaをnative SQLで計算する。

```sql
6371 * acos(
    cos(radians(:lat))
    * cos(radians(lat))
    * cos(radians(lng) - radians(:lng))
    + sin(radians(:lat))
    * sin(radians(lat))
)
```

PostgreSQLの数学functionでdistance filterとsortを実装できる。しかしdata量が増えると各candidate rowへ三角関数を適用するため、通常の`(lat, lng)` B-treeだけでは効率化しにくい。

将来PostGISを導入すれば、`geography(Point, 4326)`、`ST_DWithin`、GiST indexへ発展できる。

```sql
SELECT id, title
FROM share_posts
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
    :radiusMeters
);
```

`ST_DWithin`は利用可能なspatial indexを候補削減に使える。**現在のprojectが既にPostGISを使っているわけではなく、位置機能をscaleさせるための拡張経路**である。

### Query patternに合わせたindexを作れる

```sql
CREATE INDEX idx_prefecture_ward_town_chome
ON areas (prefecture, ward, town, chome);

CREATE INDEX idx_share_posts_status_created
ON share_posts(status, created_at DESC);

CREATE INDEX idx_reports_type_status
ON reports(type, status);
```

公開中postだけを対象にするpartial indexも使っている。

```sql
CREATE INDEX idx_share_posts_view_count
ON share_posts(view_count DESC)
WHERE status = 'OPEN';
```

よく読む`OPEN` rowだけを含めることで、全rowをindex化する場合よりサイズと更新costを抑えられる。ただしqueryのpredicateがindex条件と一致するとoptimizerが判断できる必要がある。

Indexは多いほど良いわけではない。INSERTとUPDATE時にindexも更新されdiskも使うため、`EXPLAIN ANALYZE`と実data分布を確認して管理する。

### CHECKとtriggerを利用できる

MyGomiはstatus範囲をCHECK constraintで制限し、`updated_at`を更新するPL/pgSQL functionとtriggerを定義している。

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';
```

```sql
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

DB外部からSQLを実行しても時刻が更新される一方、JPA Auditingとtriggerの両方で同じ責務を持つなら、どちらを基準にするか明確にする必要がある。

### Spring Bootと統合しやすい

```gradle
implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
runtimeOnly 'org.postgresql:postgresql'
implementation 'org.flywaydb:flyway-database-postgresql'
```

通常CRUDは`JpaRepository`、複雑なqueryはJPQLまたはnative SQLを使う。

```java
Page<SharePost>
findByWardAndCategoryAndStatusOrderByCreatedAtDesc(
        String ward,
        ShareCategory category,
        ShareStatus status,
        Pageable pageable
);
```

すべてをPostgreSQL固有SQLで書く必要はない。一般処理はJPAで生産性を確保し、radius searchやpartial indexなど必要な場所だけDB機能を利用する。

### Flywayでschema historyを管理する

```properties
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.enabled=true
```

Hibernateにはschemaを自動変更させず、Flyway migrationで履歴を残す。

```text
V1  User・地域・収集rule・address・item
V4  譲渡postとimage
V5  Chat roomとmessage
V6  Report
V7  Chat room予約同意
V8  重複chat room防止constraint
V9  User keyword設定
```

Remote Docker DBと開発者別DBでも同じmigrationを適用すればschema versionを合わせられる。一度共有したmigrationは変更せず、新versionを追加する。

## 他のRelational DBとの比較

### MySQL

MySQLも成熟したopen source relational DBで、一般的なweb CRUD、transaction、foreign key、JSON、spatial functionを提供する。Spring Bootとの統合も良い。

MyGomiをMySQLで実装できないわけではない。ただし現在使う`BIGSERIAL`、PL/pgSQL function、partial indexなどは書き換えが必要になる。将来PostGISを利用する位置検索と、PostgreSQL固有constraint・indexを考えると現在はPostgreSQLが自然だった。

一方、teamの運用経験と既存infrastructureがMySQL中心なら、その利点は大きい。製品機能だけでなく運用能力も選択costに含める。

### MariaDB

MariaDBはMySQLからforkしたopen source relational DBで、似たSQLとclient protocolを持つ。しかし現在は機能とoptimizer behaviorに差があり、完全互換と考えてはいけない。

一般的なCRUDやreplicationには十分だが、MyGomiのPostgreSQL固有index、trigger、将来のPostGIS migrationは再設計が必要になる。現在のprojectでは移行benefitよりcostが大きい。

### SQLite

SQLiteは別DB serverを持たず、一つのfileをlibraryが直接読むembedded relational DBである。Installが簡単で、test、prototype、desktop・mobile appのlocal storageに向く。

一方、複数利用者が同時writeするserver workloadとremote network accessはPostgreSQLとは異なる。MyGomiのunit testには便利でも、chat、予約、reportを複数requestが更新する主DBにはPostgreSQLが適する。

TestだけSQLiteを使う場合も、SQL syntax、type、constraint、transaction behaviorの差でproduction限定bugを見逃す可能性がある。Integration testは実PostgreSQL containerで行う方が正確である。

## NoSQL・専用storeとの比較

### MongoDB

MongoDBはBSON documentをcollectionへ保存する。Objectに近いnested data、fieldが変化するcontent、document単位で一緒に読むdataに向く。

Chat messageだけならMongoDBでも自然に実装できる。しかしMyGomiのroomはuser、post、agreementとつながり、予約結果がpost statusを変える。Email UNIQUE、status CHECK、room participant、agreement UNIQUEを中心に考えるとrelational modelが直接的である。

MongoDBもtransactionを提供するが、relationをreferenceで増やすとapplicationまたはaggregationで結合と整合性を設計する必要がある。Schema flexibilityはschemaが不要という意味ではない。

### Redis

Redisはmemory中心のKey-Value data storeで、hash、list、set、sorted set、streamなどを提供する。Cache、session、rate limit、temporary token、rankingに向く。

MyGomiではPostgreSQLの代替より補完storeとして利用できる。

- 地域別収集rule cache
- Rate limitと短期認証data
- 複数WebSocket server間のchat event
- 未読countとtemporary presence

User、post、reservation、reportのsource of truthはPostgreSQLに残し、速いtemporary dataをRedisへ置く構成が自然である。

### CassandraなどのWide-column DB

Cassandraはmulti-nodeで高いwrite throughputとavailabilityを目標にしたWide-column DBである。Queryを先に定め、partition keyとclustering keyに合わせてtableを設計する。

大規模event writeには強いが、自由なJOINやad-hoc query、relational constraint中心の予約modelには合いにくい。現在のMyGomi規模には過剰であり、将来大量chat eventやaccess logを別pipelineへ保存するときに特定workloadだけ検討できる。

### Graph DB

Neo4jのようなGraph DBはfriend-of-friend、recommendation、fraud network、path searchなど複数段のrelation探索に強い。

MyGomiにもrelationはあるが、現在のqueryは一〜二段のJOINとfilterで解決できる。将来keyword、閲覧、chat、譲渡完了を利用した高度recommendationを作る場合、分析用Graph DBを補完的に使う余地はある。

### Elasticsearch・OpenSearch

Search engineはinverted indexによるfull-text search、relevance、typo tolerance、autocomplete、log分析に強い。一方、transactionとrelational integrityを担当する主業務DBには適さず、PostgreSQLとのindex同期も必要になる。

現在の検索が単純ならPostgreSQLのfilterやfull-text機能から始め、要件が大きくなったときPostgreSQLをsource of truthとしてsearch engineへindexする。

## 選択基準のまとめ

| 要件 | 優先して検討するDB | 理由 |
| --- | --- | --- |
| 会員・予約・決済など整合性重視 | PostgreSQL, MySQL, MariaDB | Transaction、FK、constraint、SQL |
| 単一deviceのlocal storage | SQLite | Server不要のfile DB |
| 多様な独立document | MongoDB | Flexible document model |
| Cacheと期限付きdata | Redis | 高速Key-Value、TTL |
| 大規模分散event write | Cassandra | Partition中心のhorizontal scale |
| 多段relation探索 | Neo4j | Graph traversal |
| Full-text search・log分析 | Elasticsearch, OpenSearch | Inverted index |
| 位置機能を持つrelational service | PostgreSQL + PostGIS | Transactionとspatial query |

この表は出発点であり、cloud service、team経験、最新version、既存systemによって結論は変わる。

## Polyglot persistenceへの拡張

MyGomiの全データを永久にPostgreSQL一つへ入れる必要はない。機能が成長すれば各storeの役割を分けられる。

```text
PostgreSQL
├─ User・address
├─ Collection rule・item
├─ Post・reservation・report
└─ Chat messageのsource of truth

Redis
├─ Cache
├─ Rate limit
└─ WebSocket server間event

OpenSearch
├─ Post full-text search
└─ 多言語item検索

Object Storage
└─ Post image・report attachment
```

ただしdatabaseを追加するたびにdeployment、backup、monitoring、access control、障害対応、data synchronizationのcostも増える。PostgreSQLで十分な機能を流行だけで分離しない。

## PostgreSQLを選んだ後に必要なこと

### 予約のconcurrencyを制御する

二人がほぼ同時に同意する場合や、別roomから同じpostを予約する場合にはrace conditionが起こり得る。PostgreSQL transactionだけで自動解決されるわけではない。

Post rowへのpessimistic lock、JPAの`@Version`によるoptimistic lock、unique constraint、再試行・conflict responseを組み合わせる。

### 位置indexを改善する

Haversine式は各rowの座標へfunctionを適用するため、通常のB-treeを効果的に使えない可能性がある。Dataが増えたらbounding boxでcandidateを先に減らすか、PostGIS geographyとGiST indexへ移行する。

### 実行計画を確認する

```sql
EXPLAIN ANALYZE
SELECT *
FROM share_posts
WHERE status = 'OPEN'
ORDER BY created_at DESC
LIMIT 20;
```

Indexが存在してもoptimizerが必ず使うわけではない。Table size、statistics、selectivity、実行時間を確認してから変更する。

### Connection poolを管理する

Spring Bootは通常HikariCPでconnectionを再利用する。WebSocket connection数とDB connection数は同じではない。Transactionを短く保ち、query終了後にconnectionをpoolへ返す。

Application serverが増えた場合、各instanceのpool size合計がPostgreSQLの最大connection数を超えないよう計算する。

### Backupとmigration復旧を準備する

Flyway migrationはschema historyでありuser dataのbackupではない。Docker Volumeも同じhost上のdataであってbackupではない。

`pg_dump`またはphysical backupを別場所へ保存し、定期的にrestore testを行う。Destructive migrationでは旧applicationとのcompatibilityとrollback方針も準備する。

## MyGomi基準の最終判断

| MyGomiの要件 | PostgreSQLを選んだ理由 |
| --- | --- |
| User・address・post・chatのrelation | FKとJOINで明確に表現できる |
| Email・room・agreementの重複防止 | UNIQUEでDBから保証できる |
| Post・report statusの制限 | CHECKで不正値を拒否できる |
| 双方同意後の予約status変更 | ACID transactionとlockingを使える |
| 地域・category・status filter | SQL、sort、paginationに適する |
| Radius search | 数学function、将来PostGISへ拡張可能 |
| 公開postのranking | Partial indexを利用できる |
| Schema変更 | Flyway PostgreSQL migration |
| Remote Docker開発DB | Official imageで再現しやすい |

PostgreSQLだけが唯一の正解ではない。MySQLでも大部分を実装でき、初期prototypeならSQLiteが簡単な場合もある。しかし現在のrelation、constraint、transaction、位置機能、既存migrationを総合すると、PostgreSQLはMyGomiの要件に基づいた一貫性のある選択である。

{{< conclusion >}}
**結論:** MyGomiはrelationの多い業務データ、双方同意による予約、status整合性、複合query、位置検索を中心に持つため、PostgreSQLを主DBとして選んだ。MongoDBの柔軟性やRedisの速度も有用だが、現在のcore dataを置き換えるより必要な機能を補完する役割が適する。Databaseの人気ではなく、data model、transaction、query、将来拡張、teamの運用能力を基準に選ぶことが重要である。
{{< /conclusion >}}

## 参考資料

- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [PostgreSQL - Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL - Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [PostgreSQL - Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostGIS - ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [Spring Data JPA Reference](https://docs.spring.io/spring-data/jpa/reference/)
- [Flyway Documentation](https://documentation.red-gate.com/flyway)
- [MongoDB - Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Redis Documentation](https://redis.io/docs/latest/)
- [SQLite - Appropriate Uses](https://www.sqlite.org/whentouse.html)
