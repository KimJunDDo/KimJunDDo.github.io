---
title: "원격 컴퓨터의 Docker PostgreSQL을 개발 DB로 사용하기"
date: 2026-08-24
draft: false
description: "개발 컴퓨터에서 MyGomi 백엔드를 실행하고 오사카 컴퓨터의 Docker PostgreSQL만 원격 DB로 사용한 구조와 Compose, 볼륨, 네트워크, Flyway, 보안과 백업을 정리합니다."
tags: ["Docker", "PostgreSQL", "Spring Boot", "Flyway", "Remote Database"]
categories: ["DevOps"]
showTableOfContents: true
---

MyGomi 백엔드의 소스코드와 Spring Boot 애플리케이션은 개발자가 사용하는 컴퓨터에 있었다. 오사카에 있는 별도의 컴퓨터에서는 애플리케이션을 실행하지 않고, Docker로 PostgreSQL 컨테이너만 실행해 개발 DB로 사용했다.

처음에는 "PostgreSQL을 Docker로 실행했다"는 한 문장으로 설명할 수 있을 것 같았다. 하지만 실제 개발 환경에는 원격 컴퓨터, Docker Engine, PostgreSQL 컨테이너, 포트, 볼륨, Spring Boot 환경변수, Flyway 마이그레이션이 모두 연결되어 있었다. 이 구조를 이해해야 접속 오류가 발생했을 때 어느 계층을 확인해야 하는지도 알 수 있다.

{{< conclusion >}}
**이 환경에서 오사카 컴퓨터는 원격 DB 호스트일 뿐, 소스코드나 Spring Boot 실행 서버가 아니다.** 개발 컴퓨터의 Spring Boot가 네트워크를 통해 Docker PostgreSQL에 접속하고, Docker Volume이 DB 데이터를 보존하며, 애플리케이션의 Flyway가 접속 후 스키마 버전을 관리한다. 따라서 컨테이너 구성뿐 아니라 원격 연결 경로, 방화벽, 포트 노출과 백업까지 함께 설계해야 한다.
{{< /conclusion >}}

이 글에서는 Docker의 기본 개념부터 원격 컴퓨터에서 PostgreSQL을 실행하는 방법, MyGomi 프로젝트와 연결되는 과정, 데이터 보존과 운영 시 주의점까지 정리한다.

> 현재 저장소에는 당시 사용한 Docker Compose 파일과 원격 접속 도구 설정이 남아 있지 않다. 따라서 프로젝트 코드로 확인되는 부분은 그대로 설명하고, Compose와 SSH 명령은 같은 환경을 재현하기 위한 권장 예시로 구분해 작성했다.

## 전체 개발 환경

MyGomi를 개발한 환경을 단순화하면 다음과 같다.

```text
개발 컴퓨터
    ├─ 프로젝트 소스코드
    └─ Spring Boot 애플리케이션
              │
              │ PostgreSQL 연결
              │ (허용된 네트워크 또는 SSH 터널)
              ▼
오사카의 컴퓨터
    └─ Docker Engine
         └─ PostgreSQL 컨테이너
              └─ Docker Volume에 데이터 저장
```

Spring Boot와 PostgreSQL이 서로 다른 컴퓨터에서 동작하므로 DB 통신은 오사카 컴퓨터 내부에서 끝나지 않는다. 개발 컴퓨터의 애플리케이션이 오사카 컴퓨터의 호스트 주소와 공개된 Docker 포트에 접속하거나, SSH 터널을 이용해 오사카 컴퓨터의 loopback 포트로 전달해야 한다.

당시의 Compose 파일과 네트워크 접속 설정은 현재 저장소에 남아 있지 않다. 따라서 이 글은 **오사카 컴퓨터에서는 Docker PostgreSQL만 실행했다는 확인된 사실**과, 같은 구성을 안전하게 재현하기 위한 권장 접속 방식을 구분한다.

이 구조에는 다음 장점이 있었다.

- 개발 컴퓨터를 바꾸더라도 같은 PostgreSQL 인스턴스와 데이터를 사용할 수 있다.
- PostgreSQL을 호스트 운영체제에 직접 설치하지 않아도 된다.
- DB 컨테이너의 생명주기를 개발 컴퓨터의 애플리케이션 실행과 분리할 수 있다.
- 오사카 컴퓨터를 계속 켜 두면 고정된 개발 DB 호스트로 사용할 수 있다.

반면 오사카 컴퓨터의 전원, 양쪽 네트워크, 방화벽, Docker 또는 PostgreSQL 중 하나라도 문제가 생기면 애플리케이션이 DB에 접속할 수 없다. 로컬 DB보다 지연 시간이 늘 수 있고 확인해야 할 계층도 많아진다.

## Docker란?

Docker는 애플리케이션과 실행에 필요한 환경을 컨테이너라는 단위로 실행하고 관리하는 도구다. PostgreSQL을 예로 들면 운영체제에 패키지를 직접 설치하는 대신, PostgreSQL이 준비된 이미지를 내려받아 격리된 프로세스로 실행할 수 있다.

Docker를 이해할 때는 이미지와 컨테이너를 구분해야 한다.

### 이미지

이미지는 컨테이너를 만들기 위한 읽기 전용 템플릿이다. PostgreSQL 실행 파일, 기본 설정, 디렉터리 구조 등이 들어 있다.

```text
postgres:16
```

이 이름에서 `postgres`는 이미지 이름이고 `16`은 tag다. tag를 생략하고 `latest`만 사용하면 어느 시점에 다른 PostgreSQL 버전을 받게 될 수 있으므로 프로젝트에서는 버전을 명시하는 편이 안전하다.

### 컨테이너

컨테이너는 이미지를 실제로 실행한 인스턴스다. 같은 PostgreSQL 이미지로 개발용 컨테이너와 테스트용 컨테이너를 각각 만들 수도 있다.

```text
PostgreSQL 이미지 ──실행──> mygomi-postgres 컨테이너
```

컨테이너를 중지하는 것과 삭제하는 것도 다르다.

- `stop`은 실행 중인 컨테이너를 중지한다.
- `start`는 중지된 컨테이너를 다시 실행한다.
- `down`은 Compose가 만든 컨테이너와 네트워크를 제거한다.
- 컨테이너 삭제와 데이터 삭제는 볼륨 구성에 따라 별개의 작업이다.

### 컨테이너와 가상 머신의 차이

가상 머신은 하이퍼바이저 위에서 게스트 운영체제 전체를 실행한다. 컨테이너는 호스트의 커널을 공유하면서 프로세스와 파일 시스템, 네트워크를 격리한다.

| 구분 | 가상 머신 | 컨테이너 |
| --- | --- | --- |
| 실행 단위 | 게스트 운영체제를 포함한 VM | 격리된 프로세스 |
| 크기 | 비교적 큼 | 비교적 작음 |
| 시작 시간 | 운영체제 부팅 필요 | 일반적으로 빠름 |
| 격리 방식 | 하드웨어 가상화 | 커널 기능을 이용한 격리 |
| 대표 용도 | 서로 다른 OS, 강한 환경 분리 | 애플리케이션과 의존성 패키징 |

컨테이너가 아무 격리도 없는 것은 아니지만 VM과 완전히 같은 보안 경계를 제공한다고 생각해서는 안 된다. 이미지 출처, 컨테이너 권한, 호스트 보안 업데이트도 중요하다.

## Docker를 사용한 이유

PostgreSQL을 직접 설치해도 애플리케이션은 동작한다. 그럼에도 Docker를 사용한 이유는 실행 환경을 코드에 가까운 형태로 관리할 수 있기 때문이다.

### 설치 과정 단순화

호스트에 PostgreSQL 패키지를 직접 설치하면 운영체제마다 설치 경로와 서비스 관리 명령이 달라질 수 있다. Docker에서는 이미지와 환경변수, 포트, 볼륨만 정하면 비슷한 방식으로 실행할 수 있다.

### 버전 고정

프로젝트가 PostgreSQL 16을 기준으로 동작한다면 Compose 파일에 `postgres:16`을 명시할 수 있다. 새로운 컴퓨터에서도 같은 major version으로 환경을 만들기 쉽다.

### 프로젝트별 격리

다른 프로젝트가 PostgreSQL의 다른 버전이나 DB 이름을 사용해도 컨테이너와 포트를 나누면 충돌을 줄일 수 있다.

### 환경 재현

실행 명령을 개인의 기억이나 터미널 history에만 남기면 다른 사람이 같은 DB를 만들기 어렵다. Compose 파일로 이미지, 환경변수, 볼륨과 health check를 기록하면 개발 환경 자체가 문서가 된다.

## Docker의 핵심 구성 요소

PostgreSQL 컨테이너를 실행할 때 특히 알아야 할 것은 이미지, 포트, 볼륨, 환경변수와 네트워크다.

### 포트 매핑

PostgreSQL은 컨테이너 내부에서 기본적으로 `5432` 포트를 사용한다. 컨테이너는 격리된 네트워크 공간에 있으므로 **다른 컴퓨터에서 실행되는 Spring Boot**가 접속하려면 오사카 컴퓨터의 호스트 포트와 컨테이너 포트를 연결해야 한다.

```yaml
ports:
  - "127.0.0.1:5432:5432"
```

형식은 다음과 같다.

```text
호스트 주소:호스트 포트:컨테이너 포트
```

`127.0.0.1:5432:5432`는 오사카 컴퓨터 자신만 호스트의 5432 포트에 접속할 수 있게 한다. 따라서 개발 컴퓨터에서 이 포트로 직접 접속할 수는 없고 SSH 터널이 필요하다. `5432:5432`처럼 주소를 생략하면 기본적으로 호스트의 모든 주소에 publish될 수 있으므로 외부에서 접근할 수 있는 범위가 크게 넓어진다.

원격 DB를 사용한다고 해서 PostgreSQL 포트를 인터넷 전체에 공개할 필요는 없다. 권장 방식은 loopback에만 바인딩하고 SSH 터널로 접속하거나, VPN·사설망 인터페이스에만 바인딩한 뒤 방화벽에서 개발 컴퓨터의 주소만 허용하는 것이다. 직접 publish해야 한다면 Docker 설정뿐 아니라 운영체제 방화벽, PostgreSQL의 `listen_addresses`, `pg_hba.conf`와 TLS까지 함께 확인한다.

### 볼륨

컨테이너의 쓰기 가능한 파일 시스템은 컨테이너 생명주기에 묶여 있다. 컨테이너를 새로 만들 때 DB 데이터까지 사라지지 않게 하려면 PostgreSQL 데이터 디렉터리를 Docker Volume에 연결해야 한다.

```yaml
volumes:
  - mygomi-postgres-data:/var/lib/postgresql/data
```

```text
PostgreSQL 컨테이너
    └─ /var/lib/postgresql/data
                  │
                  ▼
        mygomi-postgres-data 볼륨
```

컨테이너를 제거하고 같은 볼륨을 연결해 새 컨테이너를 실행하면 기존 데이터를 다시 사용할 수 있다. 그러나 볼륨은 백업이 아니다. 호스트 디스크가 손상되거나 사용자가 볼륨을 삭제하면 데이터도 사라질 수 있으므로 별도의 dump가 필요하다.

### 환경변수

공식 PostgreSQL 이미지는 최초 DB 초기화를 위해 환경변수를 사용한다.

```yaml
environment:
  POSTGRES_DB: mygomi_db
  POSTGRES_USER: ${DB_USERNAME}
  POSTGRES_PASSWORD: ${DB_PASSWORD}
```

비밀번호를 Compose 파일에 직접 적지 않고 `.env` 또는 원격 컴퓨터의 환경변수에서 주입한다. `.env`는 반드시 `.gitignore`에 포함해야 한다.

```dotenv
DB_USERNAME=example_user
DB_PASSWORD=replace-with-a-strong-password
```

예시에 적힌 값은 실제 운영 비밀번호가 아니다. 이미 Git에 올라간 비밀값은 파일에서 지우는 것만으로 안전해지지 않으므로 해당 credential을 교체해야 한다.

### Docker 네트워크

Compose는 서비스가 서로 통신할 수 있는 기본 네트워크를 만든다. Spring Boot까지 **오사카 컴퓨터의 Compose 안에서** 실행한다면 DB 컨테이너 이름을 hostname처럼 사용할 수 있다.

```text
backend 컨테이너 ── postgres:5432 ──> postgres 컨테이너
```

하지만 MyGomi의 실제 구조에서는 Spring Boot가 오사카 컴퓨터나 그 Docker 네트워크에 있지 않았다. 개발 컴퓨터의 Spring Boot는 오사카 컴퓨터에 publish된 호스트 포트 또는 SSH 터널의 로컬 포트로 접속한다.

```text
개발 컴퓨터의 Spring Boot
    ├─ 직접 연결: osaka-db-host:5432 ──> PostgreSQL 컨테이너
    └─ SSH 터널: localhost:15432 ──> Osaka localhost:5432 ──> 컨테이너
```

이 차이는 MyGomi의 `DB_URL` 값을 정할 때 중요하다.

## Docker Compose로 PostgreSQL 구성하기

현재 MyGomi 저장소에는 당시 사용한 Compose 파일이 남아 있지 않다. 다음은 PostgreSQL을 오사카 컴퓨터의 loopback에만 publish하고 SSH 터널로 접근하는 방식의 권장 재현 예시다.

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

Compose는 여러 컨테이너를 관리하는 도구로 많이 알려져 있지만 DB 컨테이너 하나만 실행할 때도 유용하다. 긴 `docker run` 명령을 반복하지 않고 설정을 YAML로 남길 수 있기 때문이다.

### 주요 설정 설명

| 설정 | 의미 |
| --- | --- |
| `image` | 사용할 PostgreSQL 이미지와 버전 |
| `container_name` | 사람이 식별하기 쉬운 컨테이너 이름 |
| `restart` | Docker 재시작 후 컨테이너 재실행 정책 |
| `environment` | 초기 DB, 사용자와 비밀번호 설정 |
| `ports` | 호스트와 컨테이너 포트 연결 |
| `volumes` | DB 데이터 영속화 |
| `healthcheck` | PostgreSQL이 실제 요청을 받을 준비가 되었는지 검사 |

`restart: unless-stopped`는 Docker daemon이나 컴퓨터가 재시작된 후 컨테이너를 다시 실행하는 데 도움을 준다. 다만 사용자가 명시적으로 중지한 컨테이너까지 무조건 시작하지는 않는다.

### 실행 명령

Compose 파일이 있는 디렉터리에서 다음 명령으로 PostgreSQL을 백그라운드 실행한다.

```bash
docker compose up -d
```

실행 상태는 다음 명령으로 확인한다.

```bash
docker compose ps
```

PostgreSQL 초기화나 접속 오류는 로그에서 확인할 수 있다.

```bash
docker compose logs -f postgres
```

컨테이너 안에서 DB 준비 상태를 검사할 수도 있다.

```bash
docker compose exec postgres \
  pg_isready -U example_user -d mygomi_db
```

PostgreSQL CLI에 접속하려면 다음과 같이 실행한다.

```bash
docker compose exec postgres \
  psql -U example_user -d mygomi_db
```

컨테이너를 중지하고 Compose 리소스를 정리할 때는 다음 명령을 사용한다.

```bash
docker compose down
```

`docker compose down -v`는 연결된 named volume까지 제거한다. DB 데이터가 삭제될 수 있으므로 초기화가 명확한 목적일 때만 사용해야 한다.

## MyGomi Spring Boot와 PostgreSQL 연결하기

프로젝트의 `application.properties`에는 접속 정보를 직접 고정하지 않고 환경변수로 받도록 설정되어 있다.

```properties
spring.datasource.url=jdbc:postgresql://${DB_URL}/mygomi_db
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
spring.datasource.driver-class-name=org.postgresql.Driver
```

여기서 `DB_URL`은 전체 JDBC URL이 아니라 **host와 port 부분**이다.

오사카 컴퓨터의 PostgreSQL을 외부 인터페이스에 publish하고 방화벽에서 개발 컴퓨터만 허용한 경우, `DB_URL`에는 오사카 컴퓨터의 허용된 hostname 또는 사설 IP를 넣는다.

```bash
export DB_URL=osaka-db-host:5432
export DB_USERNAME=example_user
export DB_PASSWORD=replace-with-a-strong-password
./gradlew bootRun
```

최종 JDBC URL은 다음과 같이 완성된다.

```text
jdbc:postgresql://osaka-db-host:5432/mygomi_db
```

SSH 터널을 사용한다면 먼저 개발 컴퓨터에서 터널을 연다.

```bash
ssh -L 15432:127.0.0.1:5432 remote-user@osaka-host
```

그 뒤 별도의 터미널에서 Spring Boot를 실행한다.

```bash
export DB_URL=localhost:15432
export DB_USERNAME=example_user
export DB_PASSWORD=replace-with-a-strong-password
./gradlew bootRun
```

여기서 `localhost`는 PostgreSQL이 개발 컴퓨터에 있다는 뜻이 아니다. 개발 컴퓨터의 `15432` 포트를 SSH가 오사카 컴퓨터의 `127.0.0.1:5432`로 전달하기 때문에 로컬 주소처럼 보이는 것이다.

## JPA와 Flyway의 역할 분리

MyGomi는 JPA가 운영 스키마를 임의로 생성하게 두지 않고 Flyway가 SQL 마이그레이션을 관리한다.

```properties
spring.jpa.hibernate.ddl-auto=validate

spring.flyway.enabled=true
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=1
```

### `ddl-auto=validate`

`validate`는 엔티티와 실제 DB 테이블이 호환되는지 검사하지만 테이블을 자동으로 만들거나 수정하지 않는다. 엔티티를 바꿨는데 마이그레이션 SQL을 추가하지 않았다면 애플리케이션 시작 단계에서 오류를 발견할 수 있다.

개발 환경에서 `update`를 사용하면 편해 보이지만 DB 변경 이력이 명시적으로 남지 않고 환경마다 스키마가 달라질 수 있다. 여러 사람이 원격 DB를 함께 사용한다면 마이그레이션 파일로 변경 순서를 관리하는 것이 더 중요하다.

### Flyway 마이그레이션

프로젝트의 `src/main/resources/db/migration`에는 다음과 같은 버전 SQL이 있다.

```text
V1__init.sql
V2__change_lat_lng_type.sql
V3__insert_data.sql
V4__create_share_posts.sql
V5__create_chat_tables.sql
V6__create_reports.sql
V7__create_share_post_reservation_agreement.sql
V8__chat_room_unique_share_post_buyer.sql
V9__create_user_keyword_preferences.sql
```

애플리케이션이 시작되면 Flyway는 DB의 schema history와 프로젝트의 파일을 비교하고 아직 실행하지 않은 migration을 순서대로 적용한다. Docker Volume에 기존 DB가 남아 있다면 이미 적용된 migration은 다시 실행하지 않는다.

```text
PostgreSQL 컨테이너 시작
        ↓
Spring Boot 시작
        ↓
Flyway가 migration history 확인
        ↓
미적용 SQL 실행
        ↓
Hibernate가 엔티티와 스키마 검증
        ↓
애플리케이션 실행
```

이미 공유된 migration 파일을 나중에 수정하면 다른 환경의 checksum과 달라질 수 있다. 기존 파일을 고치기보다 다음 버전의 migration을 추가하는 방식이 안전하다.

## 원격 DB에 안전하게 연결하기

이 구성은 원격 개발 환경이 아니라 **로컬 애플리케이션이 원격 DB를 사용하는 분리형 환경**이다. 소스 편집과 Spring Boot 실행은 개발 컴퓨터에서 하고, 오사카 컴퓨터에는 Docker Engine과 PostgreSQL 데이터만 존재한다.

저장소만으로 당시 DB가 공인망에 직접 publish되었는지, VPN이나 SSH 터널을 사용했는지는 확인할 수 없다. 재현할 때는 PostgreSQL 5432를 인터넷 전체에 공개하기보다 SSH local port forwarding을 사용하는 편이 안전하다.

```bash
ssh -L 15432:127.0.0.1:5432 remote-user@osaka-host
```

SSH 연결이 유지되는 동안 로컬의 `127.0.0.1:15432`로 보낸 트래픽이 오사카 컴퓨터의 `127.0.0.1:5432`로 암호화되어 전달된다.

```text
로컬 DB 도구
127.0.0.1:15432
        │
        │ SSH 암호화 터널
        ▼
오사카 컴퓨터 127.0.0.1:5432
        │
        ▼
PostgreSQL 컨테이너
```

개발 컴퓨터에서 Spring Boot와 DB GUI는 모두 다음 주소를 사용할 수 있다.

```text
DB_URL=localhost:15432
```

터널이 종료되면 애플리케이션의 기존 DB 연결도 끊긴다. connection pool이 재연결할 수 있더라도 터널이 다시 열리기 전에는 새 연결을 만들 수 없으므로, 애플리케이션 장애와 DB 장애를 구분해서 확인해야 한다.

SSH 접속에는 비밀번호보다 공개키 인증을 사용하고, 개인키 파일을 저장소에 넣지 않는다. 가능하면 VPN, 허용 IP 제한, fail2ban과 다중 인증도 검토한다.

## 원격 Docker DB의 장점과 단점

### 장점

- 개발 컴퓨터를 바꿔도 같은 DB와 테스트 데이터를 유지할 수 있다.
- 장시간 실행하는 DB의 생명주기를 Spring Boot 실행과 분리할 수 있다.
- 개발 컴퓨터마다 PostgreSQL을 설치하지 않아도 된다.
- Docker 이미지와 Compose 설정으로 DB 버전과 구성을 맞출 수 있다.
- 허가된 팀원이 같은 개발 DB를 사용할 수 있다.

### 단점

- 인터넷 연결이나 SSH 터널이 끊기면 애플리케이션의 DB 연결도 끊긴다.
- 오사카 컴퓨터가 꺼지거나 Docker daemon이 중지되면 DB를 사용할 수 없다.
- 로컬 DB보다 네트워크 지연이 추가된다.
- 여러 사용자가 같은 DB를 사용하면 테스트 데이터와 migration이 충돌할 수 있다.
- 실수로 컨테이너나 볼륨을 삭제했을 때 영향 범위가 커질 수 있다.
- 공개 포트와 원격 접속 계정을 잘못 관리하면 보안 위험이 생긴다.

공유 원격 DB는 편리하지만 개발자별 격리가 필요하면 각자의 Compose project name과 볼륨, 포트를 나누거나 별도의 DB schema를 사용하는 방법도 고려해야 한다.

## 데이터는 어디에 남는가?

컨테이너와 데이터의 생명주기를 구분해야 한다.

```text
이미지: PostgreSQL 실행 환경
컨테이너: 현재 실행 중인 PostgreSQL 프로세스
볼륨: 실제 DB 파일
마이그레이션: DB 구조의 변경 이력
백업 파일: 장애 복구를 위한 별도 사본
```

컨테이너를 다시 만드는 것은 비교적 쉬워도 볼륨의 데이터는 대신 만들어지지 않는다. Flyway는 빈 DB의 테이블 구조와 기준 데이터를 재구성할 수 있지만 사용자가 생성한 계정, 게시글, 채팅 메시지까지 복원하지는 못한다.

## PostgreSQL 백업과 복구

개발용 DB라도 복구하기 어려운 데이터가 있다면 주기적으로 논리 백업을 만들어야 한다.

### 백업

custom archive 형식으로 dump를 만들 수 있다.

```bash
docker compose exec -T postgres \
  pg_dump -U example_user -d mygomi_db -Fc \
  > mygomi_db.dump
```

백업 파일은 컨테이너 밖에 생성하고, 원격 컴퓨터 한 곳에만 두지 않는 것이 좋다. 접근 권한을 제한하고 필요한 경우 암호화한 뒤 별도의 안전한 저장소로 복사한다.

### 복구

복구는 기존 데이터를 덮어쓰거나 충돌시킬 수 있으므로 대상 DB를 정확히 확인한 뒤 수행해야 한다.

```bash
docker compose exec -T postgres \
  pg_restore -U example_user -d mygomi_db \
  --clean --if-exists < mygomi_db.dump
```

백업은 생성 성공 로그만으로 충분하지 않다. 별도의 테스트 DB에 주기적으로 복구해 실제로 사용할 수 있는 파일인지 검증해야 한다.

## 자주 발생하는 문제와 확인 순서

원격 Docker DB에 연결되지 않을 때는 한 번에 모든 설정을 바꾸기보다 바깥 계층부터 확인하는 것이 좋다.

### 1. 원격 컴퓨터에 접속되는가?

먼저 원격 컴퓨터가 켜져 있고 네트워크와 원격 접속 서비스가 정상인지 확인한다. 이 단계가 실패하면 Docker나 Spring 설정의 문제가 아니다.

### 2. Docker daemon이 실행 중인가?

```bash
docker info
```

명령 자체가 daemon에 연결하지 못하면 PostgreSQL 컨테이너도 실행할 수 없다.

### 3. 컨테이너가 실행 중인가?

```bash
docker compose ps
```

`Exited`, `Restarting`, `unhealthy` 상태라면 로그를 확인한다.

### 4. PostgreSQL이 준비되었는가?

```bash
docker compose exec postgres \
  pg_isready -U example_user -d mygomi_db
```

컨테이너가 실행 중이라는 사실과 PostgreSQL이 접속을 받을 준비가 되었다는 사실은 다르다.

### 5. 포트와 hostname이 맞는가?

- 직접 연결 방식이면 `osaka-db-host:5432`처럼 오사카 컴퓨터의 허용된 주소를 사용한다.
- SSH 터널을 사용한 개발 컴퓨터의 앱은 `localhost:15432`처럼 터널의 로컬 포트를 사용한다.
- 오사카 컴퓨터에서 DB를 `127.0.0.1`에만 publish했다면 다른 컴퓨터에서 `osaka-db-host:5432`로 직접 접속할 수 없다.

### 6. 환경변수가 전달되었는가?

MyGomi는 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`가 없으면 datasource URL을 완성할 수 없다. IDE에서 실행할 때는 터미널의 환경변수가 IDE Run Configuration에 자동으로 전달되지 않을 수도 있다.

비밀번호 자체를 출력하지 말고 환경변수의 존재 여부와 실행 프로세스의 설정을 안전한 방식으로 확인한다.

### 7. Flyway 또는 JPA 검증이 실패했는가?

DB 연결에는 성공했지만 애플리케이션이 시작되지 않는다면 Flyway checksum, migration SQL 오류, 엔티티와 스키마 불일치 로그를 확인한다. 이 문제를 컨테이너 접속 실패와 혼동하지 않아야 한다.

## 운영과 보안에서 보완할 점

원격 컴퓨터에서 개발용 DB를 실행하는 것과 외부 사용자가 접속하는 운영 DB를 관리하는 것은 요구 수준이 다르다.

### PostgreSQL 포트를 공개하지 않기

가능하면 DB는 `127.0.0.1` 또는 내부 Docker 네트워크에만 노출한다. 외부 관리가 필요하면 SSH 터널이나 VPN을 사용한다. 반드시 공개해야 한다면 방화벽의 허용 IP, PostgreSQL의 `listen_addresses`와 `pg_hba.conf`, TLS를 함께 설정한다.

### 비밀정보를 Git에서 분리하기

DB 비밀번호, JWT 서명키, API key와 SSH 개인키를 저장소에 commit하지 않는다. `.env`도 기본적으로 비밀 파일로 취급한다. 운영에서는 Secret Manager나 배포 시스템의 secret 기능을 사용하는 것이 좋다.

현재 MyGomi의 DB 접속 정보는 환경변수로 분리되어 있지만 JWT 서명키는 설정 파일에 직접 들어 있다. 공개 또는 공동 저장소라면 키를 환경변수로 옮기고 이미 노출된 값은 새 키로 교체해야 한다.

### 최소 권한 DB 계정 사용하기

애플리케이션이 PostgreSQL superuser로 접속하지 않도록 한다. 애플리케이션과 migration에 필요한 권한만 가진 계정을 사용하고, 백업이나 관리 계정은 분리하는 편이 좋다.

### 이미지 버전과 업데이트 정책 정하기

PostgreSQL major version을 명시하고, minor update와 보안 패치를 정기적으로 적용한다. major version을 올릴 때는 단순히 image tag만 바꾸지 말고 PostgreSQL의 upgrade 절차와 extension 호환성을 확인한다.

### 자원 제한과 모니터링

원격 컴퓨터 한 대에서 Spring Boot와 PostgreSQL을 함께 실행하면 CPU, 메모리와 디스크를 공유한다. 디스크 부족은 DB 장애로 바로 이어질 수 있다. 컨테이너 상태뿐 아니라 볼륨 용량, PostgreSQL connection 수, 느린 쿼리와 백업 성공 여부를 확인해야 한다.

### 개발 환경과 운영 환경 분리

개발자가 직접 접속해 코드를 작성하는 원격 컴퓨터를 그대로 운영 서버로 사용하는 것은 위험하다. 운영 환경은 접근 권한, 배포 절차, 로그, 백업, 장애 대응과 데이터 보호 정책을 별도로 구성해야 한다.

## 재현 가능한 개발 환경으로 개선하기

이번 구조를 다른 컴퓨터에서도 쉽게 재현하려면 DB 인프라 파일과 애플리케이션 설정 예시를 저장소에 추가하는 것이 좋다. `compose.yaml`은 오사카 컴퓨터로 전달해 그곳에서 실행하지만, 전체 Spring Boot 소스코드를 오사카 컴퓨터에 둘 필요는 없다.

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

`.env.example`에는 실제 비밀번호가 아니라 필요한 변수 이름만 남긴다.

```dotenv
DB_URL=localhost:15432
DB_USERNAME=change-me
DB_PASSWORD=change-me
```

README에는 최소한 다음 순서를 기록한다.

1. Docker와 Java 요구 버전을 확인한다.
2. `.env.example`을 참고해 로컬 환경변수를 만든다.
3. 오사카 컴퓨터에서 `docker compose up -d`로 PostgreSQL을 실행한다.
4. 오사카 컴퓨터에서 health check가 정상인지 확인한다.
5. 개발 컴퓨터에서 SSH 터널 또는 허용된 네트워크 연결을 준비한다.
6. 개발 컴퓨터에서 `./gradlew bootRun`으로 Spring Boot를 실행한다.
7. Flyway migration 성공 로그를 확인한다.
8. 작업 종료 시 터널과 컨테이너, 데이터 보존 규칙을 확인한다.

Compose 파일도 Git으로 관리하면 DB를 어떤 이미지와 포트, 볼륨으로 실행했는지 코드 리뷰와 변경 이력에 남길 수 있다.

## 이번 환경을 통해 배운 점

Docker로 DB를 실행하는 일은 명령 하나를 외우는 것으로 끝나지 않았다. 원격 환경에서는 다음 요소가 하나의 시스템으로 연결되어 있었다.

1. 소스코드와 Spring Boot는 개발 컴퓨터에서 실행한다.
2. 오사카 컴퓨터의 Docker Engine은 PostgreSQL 컨테이너만 실행한다.
3. 포트 publish와 허용된 네트워크 또는 SSH 터널이 두 컴퓨터를 연결한다.
4. Volume이 컨테이너 교체 후에도 데이터를 보존한다.
5. 환경변수가 DB 주소와 credential을 코드에서 분리한다.
6. Flyway가 DB 스키마 변경 이력을 순서대로 적용한다.
7. JPA `validate`가 엔티티와 실제 스키마의 차이를 검사한다.
8. SSH 터널과 방화벽이 원격 DB의 불필요한 공개를 막는다.
9. dump와 복구 테스트가 Volume만으로 해결되지 않는 데이터 보호를 담당한다.

{{< conclusion >}}
**결론:** MyGomi의 소스코드와 Spring Boot는 개발 컴퓨터에 있었고, 오사카 컴퓨터는 Docker PostgreSQL만 제공하는 원격 DB 호스트였다. 이 분리는 DB 설치와 버전 관리를 단순하게 만들지만 네트워크 단절과 보안이라는 새로운 조건을 만든다. 포트 노출 범위, SSH 터널 또는 사설망, Volume, 환경변수, Flyway와 별도 백업을 함께 설계해야 재현 가능하고 안전한 개발 환경이 된다.
{{< /conclusion >}}

## 참고 자료

- [Docker Docs - What is Docker?](https://docs.docker.com/get-started/docker-overview/)
- [Docker Docs - Port publishing and mapping](https://docs.docker.com/engine/network/port-publishing/)
- [Docker Docs - Networking in Compose](https://docs.docker.com/compose/how-tos/networking/)
- [Docker Docs - Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Docker Hub - PostgreSQL Official Image](https://hub.docker.com/_/postgres)
- [PostgreSQL Documentation - Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- [Spring Boot Reference - SQL Databases](https://docs.spring.io/spring-boot/reference/data/sql.html)
- [Flyway Documentation](https://documentation.red-gate.com/flyway)
- [OpenSSH Manual - Port Forwarding](https://man.openbsd.org/ssh#L)
