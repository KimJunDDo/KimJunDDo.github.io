---
title: "MyGomi에서 PostgreSQL을 선택한 이유"
date: 2026-08-24T23:00:00+09:00
draft: false
description: "MyGomi의 관계형 데이터, 예약 트랜잭션, 위치 검색과 무결성 요구사항을 바탕으로 PostgreSQL을 선택한 이유와 주요 데이터베이스의 특징을 비교합니다."
tags: ["PostgreSQL", "Database", "Spring Boot", "JPA", "Flyway", "SQL"]
categories: ["Database"]
showTableOfContents: true
---

MyGomi 백엔드의 데이터베이스로 PostgreSQL을 사용했다. 데이터베이스를 정할 때 흔히 “많이 사용하는 DB니까”, “무료니까”라는 이유를 먼저 떠올리지만, 프로젝트의 데이터와 기능을 살펴보면 PostgreSQL을 선택할 구체적인 이유가 있다.

MyGomi에는 사용자, 주소, 지역별 쓰레기 수거 규칙, 품목, 나눔 게시글, 이미지, 채팅방, 메시지, 예약 동의, 신고 데이터가 있다. 이 데이터는 서로 독립된 문서가 아니라 ID와 상태를 통해 긴밀하게 연결된다. 특히 두 사용자의 예약 동의가 게시글 상태를 바꾸는 과정에서는 관계와 트랜잭션이 중요하다.

{{< conclusion >}}
**MyGomi에서 PostgreSQL을 선택한 가장 큰 이유는 데이터의 관계와 무결성이 핵심이기 때문이다.** 외래키·유니크·CHECK 제약으로 잘못된 상태를 DB에서도 막을 수 있고, 예약과 신고 같은 여러 단계의 작업을 트랜잭션으로 처리할 수 있다. 여기에 복합 조회, 위치 계산, partial index, Flyway와 Spring Data JPA의 조합도 프로젝트 요구사항과 잘 맞았다.
{{< /conclusion >}}

이 글에서는 먼저 데이터베이스의 종류를 정리하고, 각 선택지의 장단점을 비교한 뒤 MyGomi의 실제 코드와 스키마를 기준으로 PostgreSQL을 선택한 이유를 살펴본다.

## 데이터베이스를 선택할 때 봐야 할 것

데이터베이스 선택은 단순한 성능 순위가 아니다. 같은 DB도 데이터 모델과 쿼리, 운영 방식에 따라 잘 맞을 수도 있고 과한 선택이 될 수도 있다.

최소한 다음 질문에 답해야 한다.

- 데이터 사이의 관계가 얼마나 복잡한가?
- 여러 데이터를 한 번에 일관되게 변경해야 하는가?
- 어떤 조건으로 조회하고 정렬할 것인가?
- schema가 자주 바뀌는가, 명확하게 고정되어 있는가?
- 읽기와 쓰기 중 어느 쪽이 더 많은가?
- 한 서버에서 시작할지 여러 지역에 분산할지 결정했는가?
- 검색, 위치, 캐시, 분석처럼 특수한 기능이 필요한가?
- 팀이 설치·백업·장애 복구·모니터링을 감당할 수 있는가?

“NoSQL은 빠르고 SQL은 느리다” 또는 “PostgreSQL이 항상 가장 좋다”처럼 한 문장으로 결론을 내리면 실제 요구사항을 놓치기 쉽다. 데이터베이스마다 잘하는 작업이 다르고, 하나의 서비스에서 여러 DB를 목적에 맞게 함께 사용하기도 한다.

## 데이터베이스의 큰 분류

데이터베이스는 데이터 모델을 기준으로 관계형, 문서형, Key-Value, Wide-column, Graph, 시계열 등으로 나눌 수 있다.

| 종류 | 대표 제품 | 데이터 모델 | 잘 맞는 작업 |
| --- | --- | --- | --- |
| 관계형 DB | PostgreSQL, MySQL, MariaDB, SQLite | 테이블과 관계 | 주문, 회원, 예약, 정산, 업무 데이터 |
| 문서형 DB | MongoDB, Couchbase | JSON과 유사한 문서 | 유연한 schema, 문서 단위 데이터 |
| Key-Value DB | Redis, DynamoDB | key와 value | 캐시, 세션, 카운터, 빠른 단건 조회 |
| Wide-column DB | Cassandra, HBase | partition 기반 column | 대규모 분산 쓰기, 이벤트 데이터 |
| Graph DB | Neo4j | node와 edge | 관계 탐색, 추천, 경로 분석 |
| 시계열 DB | TimescaleDB, InfluxDB | 시간 중심 record | 센서, 메트릭, 모니터링 |
| 검색 엔진 | Elasticsearch, OpenSearch | 역색인된 document | 전문 검색, 로그 탐색 |

검색 엔진이나 Redis도 데이터를 저장하지만 모든 업무 데이터의 원본 저장소로 쓰기보다는 관계형 DB를 보완하는 용도로 사용하는 경우가 많다.

## 관계형 데이터베이스란?

관계형 데이터베이스는 데이터를 행과 열로 구성된 테이블에 저장하고, primary key와 foreign key로 테이블의 관계를 표현한다.

MyGomi의 일부 관계를 단순화하면 다음과 같다.

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

`User` 한 명은 여러 주소와 게시글을 가질 수 있고, 게시글 하나에는 여러 이미지와 채팅방이 연결된다. 채팅방에는 작성자와 신청자, 메시지와 예약 동의가 다시 연결된다.

관계형 DB에서는 JOIN을 이용해 이 관계를 조회하고, foreign key로 존재하지 않는 사용자를 참조하는 데이터를 막을 수 있다.

### 관계형 DB의 장점

- primary key, foreign key, unique, check constraint로 데이터 무결성을 보장하기 좋다.
- 여러 변경을 하나의 트랜잭션으로 묶을 수 있다.
- JOIN, 집계, 정렬, pagination 같은 복합 조회가 강력하다.
- SQL이라는 널리 알려진 질의 언어와 풍부한 도구를 사용할 수 있다.
- schema가 명확해 데이터의 구조와 의미를 파악하기 쉽다.

### 관계형 DB의 단점

- schema 변경에는 migration 관리가 필요하다.
- 관계가 많아지면 JOIN과 쿼리 최적화가 복잡해질 수 있다.
- 단순한 key 조회나 임시 cache에는 전용 Key-Value DB보다 무거울 수 있다.
- 수평 분산은 데이터 모델과 트랜잭션 요구사항에 따라 까다로울 수 있다.

MyGomi는 schema가 전혀 정해지지 않은 데이터보다 사용자, 게시글, 채팅방처럼 구조가 분명한 데이터가 많다. 따라서 관계형 모델이 자연스럽다.

## PostgreSQL의 특징

PostgreSQL은 오픈 소스 객체 관계형 데이터베이스 관리 시스템이다. 표준 SQL과 ACID 트랜잭션을 지원하면서 JSON, 배열, 전문 검색, 확장 기능과 다양한 index를 제공한다.

### PostgreSQL의 장점

- 복잡한 SQL, JOIN, 서브쿼리와 집계 기능이 강력하다.
- MVCC를 기반으로 동시 읽기와 쓰기를 처리한다.
- foreign key, CHECK, unique, exclusion constraint 등 무결성 기능이 풍부하다.
- partial index, expression index, GIN, GiST 등 다양한 index를 제공한다.
- `JSONB`를 통해 관계형 데이터와 document 데이터를 함께 다룰 수 있다.
- PostGIS extension을 사용하면 공간 데이터와 반경 검색을 확장할 수 있다.
- window function, CTE, recursive query 등 분석과 복잡한 조회에 유용한 SQL 기능이 많다.
- PL/pgSQL function과 trigger로 DB 내부 로직을 구성할 수 있다.
- 라이선스 비용 없이 사용할 수 있고 생태계와 공식 Docker 이미지도 안정적이다.

### PostgreSQL의 단점

- SQLite 같은 embedded DB보다 설치와 운영이 복잡하다.
- 프로세스 기반 connection 구조 때문에 연결 수가 많아지면 pool 관리가 중요하다.
- 튜닝 없이 모든 유형의 작업에서 자동으로 최적 성능이 나오는 것은 아니다.
- replication, backup, vacuum, index와 slow query를 운영자가 이해해야 한다.
- PostgreSQL 전용 SQL과 기능을 많이 쓰면 다른 DB로 이전하기 어려워진다.
- 단순 cache나 초고속 임시 데이터 조회에는 Redis 같은 전용 DB가 더 적합할 수 있다.

MyGomi도 `BIGSERIAL`, PL/pgSQL trigger, partial index 같은 PostgreSQL 전용 기능을 사용한다. 이는 기능상의 장점인 동시에 DB migration 비용을 높이는 trade-off다.

## MyGomi에서 PostgreSQL이 필요한 이유

### 데이터 관계가 명확하다

MyGomi의 데이터는 하나의 JSON 문서에 모두 넣기 어렵다. 게시글과 채팅을 예로 들면 한 게시글에 여러 신청자가 각각 채팅방을 만들 수 있고, 각 방에는 두 명의 참여자와 여러 메시지, 예약 동의가 연결된다.

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

메시지는 채팅방과 발신자를 참조한다.

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

관계형 DB를 사용하면 어떤 메시지가 어떤 방에 속하고 누가 보냈는지 foreign key로 연결할 수 있다. 사용자가 삭제되거나 게시글 상태가 바뀔 때 관련 데이터를 어떻게 처리할지도 constraint와 애플리케이션 정책으로 명확히 정할 수 있다.

### 데이터 무결성을 DB에서도 보장한다

서비스 코드에서 validation을 하더라도 동시 요청이나 다른 관리 도구를 통한 변경을 완전히 막지는 못한다. 중요한 규칙은 DB constraint로 한 번 더 보호하는 것이 안전하다.

MyGomi의 사용자 이메일은 중복될 수 없다.

```sql
email VARCHAR(255) NOT NULL UNIQUE
```

한 신청자가 같은 게시글에 중복 채팅방을 만들지 못하게 한다.

```sql
CONSTRAINT uq_chat_room_share_post_buyer
UNIQUE (share_post_id, buyer_id)
```

한 사용자는 같은 채팅방에 예약 동의를 한 번만 할 수 있다.

```sql
CONSTRAINT uq_chat_room_user
UNIQUE (chat_room_id, user_id)
```

게시글 상태에는 정해진 문자열만 저장할 수 있다.

```sql
CONSTRAINT chk_share_posts_status
CHECK (status IN (
    'OPEN',
    'RESERVED',
    'COMPLETED',
    'DELETED'
))
```

조회수에 음수가 저장되는 것도 막는다.

```sql
CONSTRAINT chk_share_posts_view_count
CHECK (view_count >= 0)
```

이 규칙들은 단순한 컬럼 정의가 아니라 서비스의 business rule이다. PostgreSQL이 마지막 방어선이 되어 잘못된 데이터가 저장되는 것을 막는다.

### 예약 처리에는 트랜잭션이 필요하다

예약은 한 row만 추가하는 작업이 아니다.

1. 요청한 사용자가 채팅방 참여자인지 확인한다.
2. 게시글이 `OPEN`인지 확인한다.
3. 사용자의 예약 동의를 저장한다.
4. 양쪽 모두 동의했는지 확인한다.
5. 두 명이 동의했다면 게시글을 `RESERVED`로 변경한다.

```java
@Transactional
public ReservationStatusResponseDto agree(
        Long postId,
        Long roomId,
        Long currentUserId) {
    // 채팅방과 참여자 확인
    // 동의 저장
    // 양측 동의 확인
    // 게시글 상태를 RESERVED로 변경
}
```

중간 단계가 실패했는데 동의만 저장되거나 게시글 상태만 바뀌면 데이터가 서로 맞지 않는다. 관계형 DB의 트랜잭션과 Spring의 `@Transactional`을 사용하면 작업 전체를 commit하거나 rollback할 수 있다.

PostgreSQL만 트랜잭션을 제공하는 것은 아니다. MySQL의 InnoDB, MariaDB, MongoDB도 각자의 범위에서 트랜잭션을 지원한다. 중요한 점은 MyGomi가 **다중 데이터 관계와 일관된 상태 전환을 자주 사용하므로 트랜잭션이 중심 기능인 DB가 적합하다**는 것이다.

### JOIN과 조건 조회가 많다

채팅방 목록은 사용자가 buyer 또는 seller로 참여한 방을 찾고, 상대방과 게시글 정보도 함께 읽는다.

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

신고 관리에서는 신고 유형과 상태로 pagination하고, 게시글별 신고 수를 집계한다.

```sql
SELECT target_post_id, COUNT(*)
FROM reports
WHERE type = 'SHARE_POST'
  AND status IN ('PENDING', 'IN_REVIEW')
GROUP BY target_post_id;
```

나눔 게시글은 지역, category, status를 조합해 최신순으로 조회한다. 이처럼 조건 조합과 JOIN, `COUNT`, `GROUP BY`, pagination이 많은 서비스에는 SQL이 잘 맞는다.

### 위치 기반 조회를 확장하기 좋다

MyGomi는 사용자의 대표 주소를 기준으로 일정 반경 안의 나눔 게시글을 찾는다. 현재는 위도와 경도를 `DOUBLE PRECISION`으로 저장하고 Haversine 공식을 native SQL에서 계산한다.

```sql
6371 * acos(
    cos(radians(:lat))
    * cos(radians(lat))
    * cos(radians(lng) - radians(:lng))
    + sin(radians(:lat))
    * sin(radians(lat))
)
```

PostgreSQL은 `sin`, `cos`, `acos`, `radians` 같은 수학 함수를 제공하므로 별도 서비스 없이 DB에서 거리 조건과 정렬을 처리할 수 있다.

데이터가 많아지면 현재의 Haversine 계산은 모든 후보 row에 삼각함수를 적용하므로 일반 `(lat, lng)` B-tree index만으로 충분하지 않을 수 있다. 이때 PostgreSQL의 PostGIS를 도입하면 `geography(Point, 4326)`, `ST_DWithin`, GiST index를 이용한 공간 검색으로 발전시킬 수 있다.

```sql
SELECT id, title
FROM share_posts
WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
    :radiusMeters
);
```

현재 프로젝트가 이미 PostGIS를 사용하는 것은 아니다. 다만 위치 기반 기능이 핵심인 서비스이므로 PostgreSQL에서 자연스럽게 확장할 경로가 있다는 점이 선택 이유가 된다.

### 다양한 index를 사용할 수 있다

MyGomi migration에는 조회 패턴에 맞춘 index가 있다.

```sql
CREATE INDEX idx_prefecture_ward_town_chome
ON areas (prefecture, ward, town, chome);

CREATE INDEX idx_share_posts_status_created
ON share_posts(status, created_at DESC);

CREATE INDEX idx_reports_type_status
ON reports(type, status);
```

특히 공개 상태인 게시글만 대상으로 하는 partial index도 사용한다.

```sql
CREATE INDEX idx_share_posts_view_count
ON share_posts(view_count DESC)
WHERE status = 'OPEN';
```

전체 게시글이 아니라 자주 조회하는 `OPEN` row만 index에 포함하므로 index 크기와 갱신 비용을 줄일 수 있다. partial index는 PostgreSQL의 대표적인 강점 중 하나다.

index는 많이 만들수록 좋은 것이 아니다. 읽기는 빨라질 수 있지만 INSERT와 UPDATE 시 index도 함께 갱신해야 하고 디스크를 사용한다. 실제 실행 계획과 데이터 분포를 `EXPLAIN ANALYZE`로 확인하면서 관리해야 한다.

### CHECK constraint와 trigger를 활용한다

프로젝트는 enum에 해당하는 값의 범위를 CHECK constraint로 제한한다. 또한 여러 테이블의 `updated_at`을 자동 갱신하는 PL/pgSQL function과 trigger를 정의했다.

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

JPA Auditing도 생성·수정 시각을 관리하지만 DB trigger가 있으면 애플리케이션 외부에서 SQL을 실행해도 `updated_at`이 갱신된다. 반면 같은 책임을 JPA와 trigger 양쪽에 두면 동작 시점과 기준을 명확히 해야 한다.

### Spring Boot 생태계와 잘 맞는다

프로젝트는 Spring Data JPA와 PostgreSQL JDBC driver를 사용한다.

```gradle
implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
runtimeOnly 'org.postgresql:postgresql'
implementation 'org.flywaydb:flyway-database-postgresql'
```

단순 CRUD는 `JpaRepository`의 method name query로 작성하고, 복잡한 조회는 JPQL이나 native query를 사용할 수 있다.

```java
Page<SharePost>
findByWardAndCategoryAndStatusOrderByCreatedAtDesc(
        String ward,
        ShareCategory category,
        ShareStatus status,
        Pageable pageable
);
```

PostgreSQL을 선택했다고 모든 쿼리를 PostgreSQL 전용 SQL로 작성할 필요는 없다. 일반 CRUD는 JPA로 생산성을 확보하고, 반경 검색이나 partial index처럼 DB의 장점이 필요한 부분만 native SQL과 migration으로 관리할 수 있다.

### Flyway로 schema 이력을 관리한다

MyGomi는 Hibernate가 schema를 자동으로 변경하지 않도록 설정했다.

```properties
spring.jpa.hibernate.ddl-auto=validate
spring.flyway.enabled=true
```

사용자와 지역 테이블에서 시작해 나눔, 채팅, 신고, 예약과 keyword 설정까지 `V1`부터 `V9` migration으로 변경 이력을 남긴다.

```text
V1  사용자·지역·수거 규칙·주소·품목
V4  나눔 게시글과 이미지
V5  채팅방과 메시지
V6  신고
V7  채팅방 예약 동의
V8  중복 채팅방 방지 constraint
V9  사용자 keyword 설정
```

원격 Docker DB와 개발자별 DB가 있더라도 같은 migration을 적용하면 schema 버전을 맞출 수 있다. DB 선택과 migration 전략은 별개의 문제지만 PostgreSQL용 Flyway 지원이 안정적이라는 점도 개발에 유리하다.

## PostgreSQL과 MySQL 비교

MySQL도 검증된 오픈 소스 관계형 DB이며 Spring Boot와 잘 통합된다. 일반적인 회원, 게시판, 주문 서비스는 두 DB 모두 충분히 구현할 수 있다.

| 비교 | PostgreSQL | MySQL |
| --- | --- | --- |
| SQL과 복합 query | 고급 SQL과 확장 기능이 풍부하다. | 일반적인 웹 CRUD에 강하고 생태계가 크다. |
| 무결성 기능 | 다양한 constraint와 index를 제공한다. | InnoDB에서 transaction과 FK를 안정적으로 지원한다. |
| JSON | `JSONB`, GIN index와 관련 연산이 강력하다. | JSON type과 관련 함수를 제공한다. |
| 공간 기능 | PostGIS 생태계가 매우 강하다. | 자체 spatial type과 function을 제공한다. |
| replication | streaming·logical replication을 제공한다. | replication과 InnoDB Cluster 등 선택지가 있다. |
| 운영 경험 | 기능이 많은 만큼 vacuum과 tuning 이해가 필요하다. | 호스팅과 운영 사례가 매우 많다. |

MyGomi를 MySQL로 구현할 수 없는 것은 아니다. 다만 현재 migration의 `BIGSERIAL`, PL/pgSQL function, partial index는 수정해야 한다. 위치 기능을 장기적으로 PostGIS로 확장하려는 계획과 복잡한 SQL·constraint 활용을 고려하면 PostgreSQL 쪽이 더 자연스럽다.

MySQL이 더 익숙한 팀이고 위치 검색이 단순하며 기존 운영 인프라가 MySQL 중심이라면 MySQL을 선택하는 것도 충분히 합리적이다. 기술 자체보다 팀의 운영 역량과 기존 시스템도 중요한 비용이다.

## PostgreSQL과 MariaDB 비교

MariaDB는 MySQL에서 갈라져 나온 오픈 소스 관계형 DB다. SQL 문법과 client protocol에서 비슷한 부분이 많지만 시간이 지나며 기능과 동작이 서로 달라졌으므로 완전히 같은 DB로 보면 안 된다.

### MariaDB의 장점

- 오픈 소스 중심의 개발과 다양한 storage engine을 제공한다.
- MySQL 경험을 활용하기 쉬운 부분이 많다.
- 일반적인 웹 서비스 CRUD와 replication 구성이 가능하다.
- 일부 환경에서는 MySQL 호환 도구와 hosting 선택지를 활용할 수 있다.

### MariaDB의 단점과 고려사항

- MySQL과의 호환성을 가정하고 upgrade하면 차이 때문에 문제가 생길 수 있다.
- PostgreSQL 전용 index, trigger와 PostGIS migration은 다시 작성해야 한다.
- 팀이 MariaDB 고유의 version과 optimizer 동작을 따로 관리해야 한다.

MyGomi에서는 MariaDB를 선택했을 때 얻는 특별한 이점보다 현재 PostgreSQL SQL을 옮기는 비용이 더 크다.

## PostgreSQL과 SQLite 비교

SQLite는 별도의 DB server 없이 하나의 파일을 library가 직접 읽고 쓰는 embedded 관계형 DB다.

### SQLite의 장점

- 설치와 server 운영이 거의 필요 없다.
- 하나의 파일로 DB를 만들고 복사하기 쉽다.
- 테스트, prototype, desktop·mobile app의 local 저장소에 적합하다.
- 작은 규모와 제한된 동시성에서는 매우 빠르고 단순하다.

### SQLite의 단점

- 여러 사용자가 동시에 write하는 server workload에는 제약이 있다.
- 독립된 DB server의 사용자·권한·network 운영 모델과 다르다.
- PostgreSQL의 partial index 일부 개념은 있어도 PostGIS나 다양한 server extension을 그대로 사용할 수 없다.
- 운영 중인 API server 여러 대가 하나의 DB file을 공유하는 구조에는 적합하지 않다.

MyGomi의 단위 테스트나 가벼운 local prototype에는 SQLite가 편할 수 있다. 하지만 채팅 메시지, 예약, 신고처럼 여러 요청이 동시에 데이터를 변경하고 원격 Docker 환경에서 여러 사용자가 접근하는 주 DB로는 PostgreSQL이 더 적합하다.

테스트에서만 SQLite를 쓰는 것도 주의해야 한다. SQL 문법, type, constraint와 transaction 동작이 PostgreSQL과 달라 production에서만 발생하는 오류를 놓칠 수 있다. integration test는 실제 PostgreSQL container를 사용하는 편이 정확하다.

## PostgreSQL과 MongoDB 비교

MongoDB는 JSON과 유사한 BSON document를 collection에 저장하는 문서형 DB다. 모든 document가 완전히 같은 field를 가질 필요가 없고 중첩 구조를 자연스럽게 저장할 수 있다.

### MongoDB의 장점

- 애플리케이션 객체와 비슷한 document 단위로 데이터를 저장할 수 있다.
- field가 자주 변하는 데이터나 다양한 형태의 content를 다루기 쉽다.
- document 안에 함께 읽는 데이터를 중첩하면 JOIN을 줄일 수 있다.
- replica set과 sharding을 통한 확장 기능을 제공한다.

### MongoDB의 단점과 고려사항

- 관계가 많은 데이터를 중첩하면 중복 데이터와 갱신 문제가 생길 수 있다.
- reference를 많이 사용하면 애플리케이션에서 관계를 조립하거나 aggregation을 설계해야 한다.
- foreign key와 같은 관계형 무결성 규칙을 동일한 방식으로 적용할 수 없다.
- transaction을 지원하지만 document 모델의 장점을 살리려면 transaction 경계를 별도로 고민해야 한다.
- 접근 패턴을 고려하지 않고 schema가 유연하다는 이유만으로 사용하면 오히려 데이터 형태가 불규칙해질 수 있다.

채팅 메시지만 생각하면 MongoDB collection에 저장하는 구성이 가능하다. 그러나 MyGomi의 채팅방은 사용자와 게시글, 예약 동의와 연결되고, 예약 결과는 게시글 상태를 변경한다. 사용자 email unique, 게시글 상태 CHECK, 방별 참여자와 예약 동의 unique 같은 규칙을 중심으로 보면 관계형 모델이 더 직접적이다.

MongoDB를 사용한다고 모든 메시지를 하나의 채팅방 document 배열에 끝없이 넣는 것은 좋지 않다. document 크기와 동시 update를 고려해 메시지를 별도 collection으로 분리할 가능성이 높고, 그렇게 되면 관계를 다시 관리해야 한다.

## PostgreSQL과 Redis 비교

Redis는 memory 중심의 Key-Value data store다. string뿐 아니라 hash, list, set, sorted set, stream 같은 자료구조를 제공한다.

### Redis의 장점

- 메모리 기반으로 매우 빠른 조회와 갱신이 가능하다.
- TTL을 이용한 만료 데이터 관리가 쉽다.
- cache, session, rate limit, temporary token, ranking에 적합하다.
- Pub/Sub과 Stream을 실시간 event 처리에 활용할 수 있다.

### Redis의 단점과 고려사항

- 복잡한 관계와 JOIN을 표현하는 주 DB로는 적합하지 않다.
- 메모리 비용과 eviction 정책을 관리해야 한다.
- persistence를 설정할 수 있지만 PostgreSQL과 같은 사용법과 내구성을 자동으로 보장하는 것은 아니다.
- Pub/Sub 메시지는 subscriber가 없던 동안의 전달을 보장하지 않으므로 durable messaging이 필요하면 Stream이나 message broker를 검토해야 한다.

MyGomi에서 Redis는 PostgreSQL의 대체재보다 보완재에 가깝다. 예를 들어 다음 기능에 추가할 수 있다.

- 자주 조회하는 지역별 수거 규칙 cache
- 짧은 수명의 인증 또는 rate limit 정보
- 여러 WebSocket server 사이의 chat event 전달
- 읽지 않은 알림 수와 임시 presence 정보

사용자, 게시글, 예약과 신고의 원본 데이터는 PostgreSQL에 두고, 빠른 임시 데이터만 Redis에 두는 polyglot persistence가 자연스럽다.

## PostgreSQL과 Cassandra 같은 Wide-column DB 비교

Cassandra는 여러 node에 데이터를 분산하고 높은 write 처리량과 가용성을 목표로 하는 Wide-column DB다. query를 먼저 정하고 partition key와 clustering key에 맞춰 table을 설계하는 방식이 중요하다.

### Wide-column DB의 장점

- 여러 node에 걸친 대규모 수평 확장을 목표로 설계되었다.
- log, event, IoT처럼 지속적으로 쌓이는 write workload에 적합하다.
- 일부 node 장애에도 서비스를 계속 제공하는 구성을 만들 수 있다.

### Wide-column DB의 단점과 고려사항

- 임의 JOIN과 자유로운 ad-hoc query에 적합하지 않다.
- 같은 데이터를 조회 방식별 table에 중복 저장할 수 있다.
- partition key를 잘못 설계하면 hotspot이나 큰 partition 문제가 생긴다.
- 관계형 transaction과 constraint 중심의 업무 모델을 그대로 옮기기 어렵다.

현재 MyGomi 규모와 예약 중심의 관계형 데이터에는 Cassandra가 과한 선택이다. 향후 매우 많은 채팅 event나 접속 log를 별도 분석 pipeline으로 저장한다면 특정 workload에 한해 검토할 수 있다.

## PostgreSQL과 Graph DB 비교

Neo4j 같은 Graph DB는 node와 relationship을 중심으로 데이터를 저장한다. 여러 단계의 관계를 따라가는 query에 강하다.

### Graph DB가 잘 맞는 경우

- 친구의 친구 탐색
- 사용자와 상품 관계를 이용한 추천
- 사기 거래 network 분석
- 경로 탐색과 dependency 분석

MyGomi에 사용자, 게시글과 채팅 관계가 있기는 하지만 현재 query는 대부분 한두 단계 JOIN과 filter로 해결된다. Graph DB를 주 DB로 도입할 이유는 크지 않다.

향후 사용자 관심 keyword, 조회, 채팅, 나눔 완료 관계를 이용해 복잡한 추천을 만든다면 분석용 Graph DB를 보완적으로 사용할 수 있다. 그래도 회원과 예약의 원본 transaction은 PostgreSQL에 남기는 구조가 일반적이다.

## PostgreSQL과 검색 엔진 비교

Elasticsearch와 OpenSearch는 역색인을 이용한 전문 검색과 log 분석에 강하다.

### 검색 엔진의 장점

- 형태소 분석, relevance score, typo 대응과 autocomplete를 구현하기 좋다.
- 많은 document에서 keyword와 복합 filter를 빠르게 처리할 수 있다.
- log와 event의 집계·시각화 생태계가 풍부하다.

### 검색 엔진의 단점과 고려사항

- transaction과 관계 무결성을 담당하는 주 업무 DB로는 부적합하다.
- PostgreSQL과 검색 index 사이의 동기화가 필요하다.
- mapping, shard, index lifecycle과 cluster 운영 비용이 생긴다.

현재 품목 검색과 게시글 filter가 단순하다면 PostgreSQL의 `LIKE`, index, 전문 검색 기능부터 검토하는 것이 운영 부담이 적다. 검색 규모와 요구 수준이 커졌을 때 PostgreSQL을 source of truth로 두고 검색 엔진에 index하는 방식으로 확장할 수 있다.

## 데이터베이스별 선택 기준 요약

| 요구사항 | 우선 검토할 DB | 이유 |
| --- | --- | --- |
| 회원·예약·정산처럼 무결성이 중요함 | PostgreSQL, MySQL, MariaDB | transaction, FK, constraint, SQL |
| 단일 장치의 local 저장 | SQLite | 별도 server 없이 파일로 동작 |
| 구조가 다양한 독립 document | MongoDB | 유연한 document 모델 |
| cache와 만료 데이터 | Redis | 빠른 Key-Value와 TTL |
| 대규모 분산 event write | Cassandra | partition 기반 수평 확장 |
| 다단계 관계 탐색 | Neo4j | Graph traversal |
| 전문 검색과 log 분석 | Elasticsearch, OpenSearch | 역색인과 검색 query |
| 위치 기반 관계형 서비스 | PostgreSQL + PostGIS | transaction과 공간 query 결합 |

이 표는 출발점일 뿐 절대적인 규칙은 아니다. 제품별 최신 기능과 운영 환경, cloud 서비스, 팀 경험에 따라 결론은 달라질 수 있다.

## MyGomi에 다른 DB를 적용한다면

MyGomi는 모든 데이터를 PostgreSQL 하나에 영원히 넣어야 하는 프로젝트는 아니다. 기능이 성장하면 각 DB의 장점을 조합할 수 있다.

```text
PostgreSQL
├─ 사용자·주소
├─ 수거 규칙·품목
├─ 게시글·예약·신고
└─ 채팅 메시지의 원본

Redis
├─ cache
├─ rate limit
└─ WebSocket server 간 event

OpenSearch
├─ 게시글 전문 검색
└─ 다국어 품목 검색

Object Storage
└─ 게시글 이미지와 신고 첨부파일
```

이를 polyglot persistence라고 한다. 하나의 DB로 모든 문제를 억지로 해결하는 대신 각 데이터의 성격에 맞는 저장소를 사용한다.

다만 DB를 하나 추가할 때마다 배포, backup, monitoring, 권한 관리, 장애 대응과 데이터 동기화 비용도 함께 추가된다. 현재 PostgreSQL로 충분한 기능을 유행이나 막연한 성능 기대 때문에 분리할 필요는 없다.

## PostgreSQL을 선택했다고 끝은 아니다

적절한 DB를 골랐더라도 schema와 query를 잘못 설계하면 성능과 정합성 문제가 생긴다.

### 예약 동시성을 보완해야 한다

현재 예약 서비스는 동의를 저장한 뒤 두 명이 모두 동의했는지 조회해 게시글을 `RESERVED`로 변경한다. 서로 다른 요청이 거의 동시에 실행되면 transaction timing에 따른 경쟁 상태를 검토해야 한다.

PostgreSQL의 row lock이나 JPA의 pessimistic lock, `@Version`을 이용한 optimistic lock을 적용할 수 있다. DB가 transaction을 지원한다는 사실만으로 올바른 동시성 제어가 자동 완성되는 것은 아니다.

### 위치 index를 개선해야 한다

현재 `(lat, lng)` index가 있지만 Haversine 식이 각 row의 좌표에 함수를 적용하므로 DB가 해당 B-tree index를 효과적으로 사용하지 못할 수 있다. 데이터가 늘어나면 bounding box로 후보를 먼저 줄이거나 PostGIS의 geography와 GiST index로 전환해야 한다.

### 실제 실행 계획을 확인해야 한다

index가 있다고 query가 반드시 그 index를 사용하는 것은 아니다. PostgreSQL optimizer는 table 크기와 통계를 바탕으로 sequential scan이 더 싸다고 판단할 수도 있다.

```sql
EXPLAIN ANALYZE
SELECT *
FROM share_posts
WHERE status = 'OPEN'
ORDER BY created_at DESC
LIMIT 20;
```

느린 query는 추측으로 index를 추가하기보다 실행 계획, row 수, filter 선택도와 실제 응답 시간을 확인해야 한다.

### connection pool을 관리해야 한다

Spring Boot는 일반적으로 HikariCP를 통해 DB connection을 재사용한다. WebSocket 연결 수와 DB connection 수는 같은 것이 아니다. 사용자가 WebSocket을 오래 유지한다고 그 수만큼 PostgreSQL connection을 계속 점유하도록 설계해서는 안 된다.

transaction 범위를 짧게 유지하고 query가 끝난 뒤 connection이 pool로 반환되게 해야 한다. 서버가 여러 대로 늘어나면 각 인스턴스의 pool 크기 합계가 PostgreSQL의 최대 connection 수를 넘지 않는지도 계산해야 한다.

### 백업과 migration 복구를 준비해야 한다

Flyway migration은 schema 변경 이력이지 사용자 데이터의 backup이 아니다. Docker Volume도 같은 host에 있는 데이터일 뿐 backup이 아니다.

정기적인 `pg_dump` 또는 물리 backup, 별도 위치 보관, 실제 restore test가 필요하다. destructive migration을 배포할 때는 이전 애플리케이션과의 호환성과 rollback 전략도 준비해야 한다.

## 프로젝트 기준 최종 판단

MyGomi의 요구사항과 PostgreSQL의 특성을 다시 연결하면 다음과 같다.

| MyGomi 요구사항 | PostgreSQL을 선택한 이유 |
| --- | --- |
| 사용자·주소·게시글·채팅의 관계 | FK와 JOIN으로 명확하게 표현 가능 |
| 중복 이메일·채팅방·예약 동의 방지 | UNIQUE constraint로 DB에서 보장 |
| 게시글과 신고 상태 제한 | CHECK constraint로 잘못된 값 차단 |
| 양측 동의 후 예약 상태 변경 | ACID transaction과 locking 활용 가능 |
| 지역·category·상태별 조회 | SQL filter, 정렬, pagination에 적합 |
| 반경 내 게시글 검색 | 수학 함수 사용, 향후 PostGIS 확장 가능 |
| 공개 게시글 인기순 조회 | partial index 활용 가능 |
| schema 변경 관리 | Flyway PostgreSQL migration 지원 |
| 원격 Docker 개발 환경 | 공식 이미지와 환경변수 기반 실행이 간단함 |

MyGomi에 PostgreSQL이 유일한 정답은 아니다. MySQL로도 대부분의 기능을 구현할 수 있고, 초기 prototype이라면 SQLite가 더 단순할 수 있다. 하지만 현재 코드가 사용하는 관계, constraint, transaction, 위치 기능과 PostgreSQL 전용 SQL까지 고려하면 PostgreSQL은 프로젝트 요구사항에 근거한 일관된 선택이다.

{{< conclusion >}}
**결론:** MyGomi는 관계가 많은 업무 데이터와 양측 동의 예약, 상태 무결성, 복합 조회와 위치 검색이 핵심이므로 PostgreSQL을 주 데이터베이스로 선택했다. MongoDB의 유연성이나 Redis의 속도도 장점이지만 현재 핵심 데이터를 대체하기보다 필요한 기능을 보완하는 역할이 더 적합하다. 중요한 것은 DB의 인기보다 데이터 모델, transaction, query, 확장 계획과 팀의 운영 능력을 기준으로 선택하는 것이다.
{{< /conclusion >}}

## 참고 자료

- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [PostgreSQL Documentation - Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL Documentation - Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL Documentation - Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Spring Data JPA Reference](https://docs.spring.io/spring-data/jpa/reference/)
- [Flyway Documentation](https://documentation.red-gate.com/flyway)
- [MongoDB Documentation - Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)
- [Redis Documentation](https://redis.io/docs/latest/)
- [SQLite Documentation - Appropriate Uses](https://www.sqlite.org/whentouse.html)
