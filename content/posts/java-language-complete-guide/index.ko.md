---
title: "Java 한 번에 배우기: 기초 문법부터 객체지향, 컬렉션과 알고리즘까지"
date: 2026-09-06
draft: false
description: "Java의 실행 구조와 기초 문법부터 객체지향, 제네릭, 컬렉션, 예외, 스트림, 파일 처리, 동시성과 기본 알고리즘 구현까지 예제로 자세히 정리합니다."
tags: ["Java", "Programming Basics", "OOP", "Collection", "Data Structure", "Algorithm"]
categories: ["Java"]
showTableOfContents: true
---

Java는 백엔드 서버, Android, 기업용 시스템, 배치 프로그램과 다양한 도구를 만드는 데 사용되는 범용 프로그래밍 언어다. 문법만 익히는 것은 어렵지 않지만, 객체의 책임을 나누고 컬렉션과 예외를 올바르게 사용하며 문제에 맞는 알고리즘을 선택하려면 기본 원리를 함께 이해해야 한다.

이 글은 처음 Java를 배우는 사람이 순서대로 읽을 수 있도록 구성했다. 변수와 제어문에서 시작해 객체지향, 제네릭, 컬렉션, 람다와 스트림, 파일 처리와 동시성으로 확장한다. 마지막에는 탐색·정렬·스택·큐·해시·그래프·동적 계획법 알고리즘을 직접 구현하고, 배운 내용을 작은 주문 관리 프로그램에 적용한다.

예제는 **Java 21 이상**을 기준으로 작성했다. `record`, switch expression, pattern matching처럼 비교적 현대적인 문법도 다루지만, 각 기능이 왜 필요한지부터 설명한다.

{{< conclusion >}}
**핵심:** Java를 잘 사용한다는 것은 문법을 많이 외우는 것이 아니다. **값과 참조의 차이, 객체의 책임, 인터페이스를 통한 추상화, 컬렉션의 시간 복잡도, 예외와 자원의 수명**을 이해하고 문제에 맞는 구조를 선택하는 것이 중요하다.
{{< /conclusion >}}

## Java 프로그램이 실행되는 구조

### JDK, JVM과 바이트코드

Java 소스 파일은 바로 CPU 명령어가 되지 않는다. `javac` 컴파일러가 `.java` 파일을 JVM이 이해하는 바이트코드인 `.class` 파일로 변환하고, JVM이 이를 실행한다.

```text
Main.java → javac → Main.class → JVM → 운영체제와 CPU
```

- **JDK(Java Development Kit):** 컴파일러, 실행기, 디버거와 표준 라이브러리를 포함한 개발 도구다.
- **JVM(Java Virtual Machine):** 바이트코드를 읽고 실행하며 메모리와 가비지 컬렉션을 관리한다.
- **JRE(Java Runtime Environment):** Java 프로그램 실행에 필요한 JVM과 라이브러리를 가리키던 배포 개념이다. 현대 JDK에서는 필요한 런타임을 `jlink` 등으로 구성할 수도 있다.

플랫폼마다 JVM 구현은 다르지만 같은 바이트코드를 실행할 수 있기 때문에 Java는 높은 이식성을 가진다. 다만 파일 경로, 기본 문자 인코딩, 네이티브 라이브러리처럼 운영체제의 영향을 받는 요소까지 자동으로 같아지는 것은 아니다.

### 첫 프로그램

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

파일 이름은 `public class` 이름과 같은 `Main.java`로 작성한다.

```bash
javac Main.java
java Main
```

`main`은 프로그램의 시작점이다. `public`은 JVM이 접근할 수 있다는 뜻이고, `static`이므로 `Main` 객체를 만들지 않아도 호출할 수 있다. `String[] args`에는 명령행 인수가 들어온다.

## 변수, 자료형과 연산자

### 기본형과 참조형

Java의 자료형은 크게 기본형과 참조형으로 나뉜다.

| 분류 | 자료형 | 설명 |
| --- | --- | --- |
| 논리 | `boolean` | `true` 또는 `false` |
| 정수 | `byte`, `short`, `int`, `long` | 크기가 다른 부호 있는 정수 |
| 문자 | `char` | UTF-16 코드 단위 하나 |
| 실수 | `float`, `double` | IEEE 754 부동소수점 수 |
| 참조형 | 배열, 클래스, 인터페이스, `String` | 객체를 가리키는 참조 |

```java
int age = 25;
long population = 51_000_000L;
double temperature = 23.5;
boolean active = true;
char grade = 'A';
String name = "Kim";
```

숫자의 `_`는 가독성을 위한 구분자다. `long` 리터럴에는 `L`, `float` 리터럴에는 `F`를 붙인다.

지역 변수는 사용 전에 반드시 초기화해야 한다. 반면 객체의 필드는 `0`, `false`, `null` 같은 기본값으로 초기화되지만, 기본값에 무심코 의존하기보다 생성자에서 유효한 상태를 만드는 편이 좋다.

### 값 복사와 참조 복사

Java의 인수 전달은 항상 **값 전달(pass by value)**이다. 기본형은 값 자체가 복사되고, 객체 변수는 객체를 가리키는 참조값이 복사된다.

```java
static void rename(StringBuilder builder) {
    builder.append(" DDo");       // 같은 객체의 상태를 변경한다.
    builder = new StringBuilder(); // 복사된 지역 참조만 바뀐다.
}

StringBuilder name = new StringBuilder("Jun");
rename(name);
System.out.println(name); // Jun DDo
```

메서드 안에서 참조 변수를 다른 객체로 바꿔도 호출자의 변수는 바뀌지 않는다. 그러나 두 참조가 같은 가변 객체를 가리킨다면 그 객체의 상태 변경은 호출자에게도 보인다.

### 형변환

작은 정수형에서 큰 정수형으로의 변환은 자동으로 가능하지만, 정보가 사라질 수 있는 변환은 명시해야 한다.

```java
int count = 10;
long total = count;       // widening conversion

double price = 19.9;
int truncated = (int) price; // 19, 소수 부분이 버려진다.
```

금액 계산에는 `double`보다 `BigDecimal`이 적합하다.

```java
import java.math.BigDecimal;

BigDecimal price = new BigDecimal("19.90");
BigDecimal quantity = BigDecimal.valueOf(3);
BigDecimal totalPrice = price.multiply(quantity);
```

`new BigDecimal(0.1)`은 이미 근사된 `double` 값을 받으므로 피하고 문자열이나 `BigDecimal.valueOf`를 사용한다.

### 주요 연산자

```java
int sum = 3 + 2;
int remainder = 7 % 3;
boolean adult = age >= 18;
boolean allowed = active && adult;
int max = (a > b) ? a : b;
```

`&&`와 `||`는 결과가 결정되면 오른쪽 식을 평가하지 않는 단락 평가를 한다.

```java
if (user != null && user.isActive()) {
    // user가 null이면 오른쪽 메서드는 호출되지 않는다.
}
```

## 조건문과 반복문

### `if`, `else if`, `else`

```java
static String grade(int score) {
    if (score >= 90) {
        return "A";
    } else if (score >= 80) {
        return "B";
    } else {
        return "C";
    }
}
```

조건의 순서가 중요하다. `score >= 80`을 먼저 검사하면 95점도 B가 된다. 경계값인 79, 80, 89, 90을 테스트해야 한다.

### switch expression

현대 Java의 switch는 값을 반환할 수 있다.

```java
static int shippingFee(String level) {
    return switch (level) {
        case "VIP" -> 0;
        case "GOLD" -> 2_000;
        case "NORMAL" -> 3_000;
        default -> throw new IllegalArgumentException("Unknown level: " + level);
    };
}
```

화살표 문법은 기존 switch의 의도하지 않은 fall-through를 방지한다. 여러 문장이 필요하면 블록 안에서 `yield`로 값을 반환한다.

### `for`, 향상된 `for`, `while`

```java
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}

int[] scores = {90, 85, 100};
for (int score : scores) {
    System.out.println(score);
}

int index = 0;
while (index < scores.length) {
    System.out.println(scores[index]);
    index++;
}
```

인덱스가 필요 없으면 향상된 for문이 읽기 쉽다. 컬렉션을 순회하면서 구조를 직접 변경하면 `ConcurrentModificationException`이 발생할 수 있으므로 `Iterator.remove`, `removeIf` 또는 새 컬렉션 생성을 사용한다.

## 배열과 문자열

### 배열

배열은 같은 자료형의 값을 고정된 길이로 저장한다.

```java
int[] numbers = {4, 2, 7, 1};
System.out.println(numbers.length);

for (int i = 0; i < numbers.length; i++) {
    numbers[i] *= 2;
}
```

인덱스 범위는 `0`부터 `length - 1`이다. 범위를 벗어나면 `ArrayIndexOutOfBoundsException`이 발생한다.

2차원 배열의 각 행 길이는 서로 다를 수 있다.

```java
int[][] triangle = {
    {1},
    {2, 3},
    {4, 5, 6}
};
```

### `String`은 불변 객체다

```java
String original = "Java";
String upper = original.toUpperCase();

System.out.println(original); // Java
System.out.println(upper);    // JAVA
```

문자열 메서드는 원본을 바꾸지 않고 새 문자열을 만든다. 반복문에서 문자열을 계속 `+`로 연결하면 중간 객체가 많이 생길 수 있으므로 `StringBuilder`를 사용한다.

```java
StringBuilder builder = new StringBuilder();
for (int i = 1; i <= 3; i++) {
    if (i > 1) {
        builder.append(", ");
    }
    builder.append(i);
}
String result = builder.toString(); // 1, 2, 3
```

### `==`와 `equals`

참조형에서 `==`는 같은 객체를 가리키는지 비교하고, `equals`는 객체가 정의한 논리적 동등성을 비교한다.

```java
String a = new String("java");
String b = new String("java");

System.out.println(a == b);      // false
System.out.println(a.equals(b)); // true
```

문자열과 값 객체의 내용을 비교할 때는 `equals`를 사용한다. null 가능성이 있으면 `Objects.equals(a, b)`가 편리하다.

## 메서드 설계

### 매개변수와 반환값

```java
static double average(int[] values) {
    if (values == null || values.length == 0) {
        throw new IllegalArgumentException("values must not be empty");
    }

    long sum = 0;
    for (int value : values) {
        sum += value;
    }
    return (double) sum / values.length;
}
```

좋은 메서드는 하나의 책임을 가지며 이름만으로 의도를 짐작할 수 있다. 입력의 허용 범위와 실패 방식을 명확히 정해야 한다.

### 오버로딩과 가변 인수

같은 이름에 매개변수 목록이 다른 메서드를 정의하는 것을 오버로딩이라고 한다.

```java
static int add(int a, int b) {
    return a + b;
}

static double add(double a, double b) {
    return a + b;
}

static int sum(int... values) {
    int result = 0;
    for (int value : values) {
        result += value;
    }
    return result;
}
```

반환형만 다른 메서드는 오버로딩할 수 없다. 가변 인수는 내부에서 배열로 취급되며 매개변수 목록의 마지막에 하나만 둘 수 있다.

### 재귀 호출

```java
static long factorial(int n) {
    if (n < 0) {
        throw new IllegalArgumentException("n must be non-negative");
    }
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}
```

재귀에는 반드시 종료 조건이 필요하다. 호출 깊이가 너무 크면 `StackOverflowError`가 발생하므로 단순 반복으로 바꿀 수 있는 문제인지도 검토한다. 또한 `long` 팩토리얼은 20!까지만 정확히 담을 수 있다.

## 클래스와 객체지향

### 클래스, 필드와 생성자

```java
public final class BankAccount {
    private final String accountNumber;
    private long balance;

    public BankAccount(String accountNumber, long initialBalance) {
        if (accountNumber == null || accountNumber.isBlank()) {
            throw new IllegalArgumentException("accountNumber is required");
        }
        if (initialBalance < 0) {
            throw new IllegalArgumentException("balance must be non-negative");
        }
        this.accountNumber = accountNumber;
        this.balance = initialBalance;
    }

    public void deposit(long amount) {
        requirePositive(amount);
        balance = Math.addExact(balance, amount);
    }

    public void withdraw(long amount) {
        requirePositive(amount);
        if (balance < amount) {
            throw new IllegalStateException("insufficient balance");
        }
        balance -= amount;
    }

    public long getBalance() {
        return balance;
    }

    private static void requirePositive(long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("amount must be positive");
        }
    }
}
```

필드를 `private`으로 감추고 객체가 유효한 상태를 스스로 지키게 하는 것을 캡슐화라고 한다. 잔액을 직접 수정하게 두지 않고 입금과 출금이라는 의미 있는 메서드를 제공하면 규칙을 한곳에서 보장할 수 있다.

### 접근 제어자

| 접근 제어자 | 같은 클래스 | 같은 패키지 | 자식 클래스 | 모든 위치 |
| --- | --- | --- | --- | --- |
| `private` | O | X | X | X |
| package-private | O | O | X | X |
| `protected` | O | O | O | X |
| `public` | O | O | O | O |

접근 범위는 필요한 만큼만 공개한다. 구현 세부사항이 외부에 노출될수록 변경하기 어려워진다.

### `static`, `final`과 불변성

- `static` 필드와 메서드는 특정 객체가 아니라 클래스에 속한다.
- `final` 변수는 한 번만 대입할 수 있다.
- `final` 메서드는 override할 수 없고 `final` 클래스는 상속할 수 없다.

`final List<String>`은 리스트 참조를 바꾸지 못하게 할 뿐, 리스트 내부 변경까지 막지는 않는다. 불변 목록이 필요하면 `List.copyOf`나 `List.of`를 사용할 수 있다.

### record로 값 객체 만들기

```java
public record Product(long id, String name, int price) {
    public Product {
        if (id <= 0 || name == null || name.isBlank() || price < 0) {
            throw new IllegalArgumentException("invalid product");
        }
    }
}
```

record는 데이터 전달이나 값 객체에 필요한 접근자, `equals`, `hashCode`, `toString`을 자동으로 만든다. record의 컴포넌트 참조는 바꿀 수 없지만 내부에 가변 객체가 있으면 깊은 불변성이 자동으로 보장되지는 않는다.

## 상속, 추상 클래스와 인터페이스

### 상속과 다형성

```java
abstract class Shape {
    public abstract double area();
}

final class Circle extends Shape {
    private final double radius;

    Circle(double radius) {
        if (radius <= 0) {
            throw new IllegalArgumentException("radius must be positive");
        }
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }
}
```

```java
List<Shape> shapes = List.of(new Circle(2.0), new Circle(3.0));
double totalArea = 0;
for (Shape shape : shapes) {
    totalArea += shape.area();
}
```

부모 타입 변수로 여러 자식 객체를 다루고 실제 객체의 override 메서드가 실행되는 것이 다형성이다. 상속은 강한 결합을 만들기 때문에 단순한 코드 재사용 목적이라면 객체 조합을 먼저 고려한다.

### 인터페이스로 역할 분리하기

```java
interface MessageSender {
    void send(String recipient, String message);
}

final class NotificationService {
    private final MessageSender sender;

    NotificationService(MessageSender sender) {
        this.sender = sender;
    }

    void notifyOrderCompleted(String email, long orderId) {
        sender.send(email, "Order completed: " + orderId);
    }
}
```

`NotificationService`는 이메일이나 문자 전송 구현을 직접 알지 않는다. `MessageSender` 역할에만 의존하므로 구현을 교체하거나 테스트용 fake를 넣기 쉽다. 이것이 의존성 역전과 의존성 주입의 기초다.

## 제네릭

제네릭은 자료형을 매개변수로 받아 컴파일 시점에 타입 안전성을 확보한다.

```java
public final class Box<T> {
    private final T value;

    public Box(T value) {
        this.value = value;
    }

    public T get() {
        return value;
    }
}

Box<String> nameBox = new Box<>("Java");
String value = nameBox.get();
```

### bounded type과 와일드카드

```java
static double sumNumbers(List<? extends Number> numbers) {
    double sum = 0;
    for (Number number : numbers) {
        sum += number.doubleValue();
    }
    return sum;
}

static void addDefaults(List<? super Integer> target) {
    target.add(0);
    target.add(1);
}
```

읽는 생산자는 `? extends T`, 값을 넣는 소비자는 `? super T`를 사용하는 **PECS(Producer Extends, Consumer Super)** 원칙으로 기억할 수 있다. `List<Integer>`는 `List<Number>`의 하위 타입이 아니다.

## 컬렉션 프레임워크

### List, Set, Map, Queue 선택

| 자료구조 | 대표 구현 | 특징 | 대표 연산 |
| --- | --- | --- | --- |
| `List` | `ArrayList` | 순서와 중복 허용, 인덱스 접근 | 조회 O(1), 중간 삽입 O(n) |
| `Set` | `HashSet` | 중복 제거 | 평균 검색·삽입 O(1) |
| 정렬된 Set | `TreeSet` | 정렬 상태 유지 | 검색·삽입 O(log n) |
| `Map` | `HashMap` | key-value 저장 | 평균 검색·삽입 O(1) |
| 정렬된 Map | `TreeMap` | key 순서 유지 | 검색·삽입 O(log n) |
| `Queue` | `ArrayDeque` | FIFO 처리 | 양 끝 삽입·삭제 O(1) |
| 우선순위 큐 | `PriorityQueue` | 우선순위가 작은/큰 값부터 처리 | 삽입·삭제 O(log n) |

Big-O는 입력 크기가 커질 때 연산량이 어떻게 증가하는지 나타낸다. 해시 자료구조의 O(1)은 평균적인 경우이며 해시 충돌과 구현 상태에 따라 달라질 수 있다.

```java
List<String> names = new ArrayList<>();
names.add("Kim");
names.add("Lee");

Set<String> uniqueNames = new HashSet<>(names);

Map<String, Integer> scores = new HashMap<>();
scores.put("Kim", 95);
scores.merge("Kim", 5, Integer::sum);

Deque<String> queue = new ArrayDeque<>();
queue.offerLast("first");
String first = queue.pollFirst();
```

스택 용도로 오래된 `Stack` 클래스보다 `ArrayDeque`의 `push`, `pop`, `peek`를 사용하는 것이 일반적이다. `HashMap`과 `ArrayList`는 스레드 안전하지 않으므로 여러 스레드가 동시에 변경한다면 별도의 동기화나 concurrent collection이 필요하다.

### `equals`와 `hashCode`

`HashMap`과 `HashSet`은 `hashCode`로 후보 위치를 찾고 `equals`로 논리적 동등성을 확인한다. 두 객체가 `equals`로 같다면 반드시 같은 `hashCode`를 반환해야 한다.

값 객체에는 record를 사용하면 두 메서드가 함께 생성된다.

```java
record UserId(long value) {
    UserId {
        if (value <= 0) {
            throw new IllegalArgumentException("value must be positive");
        }
    }
}

Map<UserId, String> users = new HashMap<>();
users.put(new UserId(1), "Kim");
System.out.println(users.get(new UserId(1))); // Kim
```

해시 key로 사용하는 객체의 동등성에 참여하는 필드는 저장 후 변경하지 않는 것이 안전하다.

### 정렬과 Comparator

```java
record Student(String name, int score) {}

List<Student> students = new ArrayList<>(List.of(
    new Student("Kim", 90),
    new Student("Lee", 100),
    new Student("Park", 90)
));

students.sort(
    Comparator.comparingInt(Student::score).reversed()
              .thenComparing(Student::name)
);
```

자연 순서는 `Comparable`, 상황별 정렬 규칙은 `Comparator`로 표현한다. 위 코드는 점수 내림차순, 동점이면 이름 오름차순으로 정렬한다.

## 예외 처리와 자원 관리

### checked exception과 unchecked exception

- `Exception` 중 `RuntimeException`이 아닌 예외는 checked exception이며 호출자가 처리하거나 `throws`로 선언해야 한다.
- `RuntimeException`과 그 하위 예외는 unchecked exception이다.
- `Error`는 보통 애플리케이션이 복구하려고 잡는 대상이 아니다.

```java
static int parsePositiveInt(String text) {
    try {
        int value = Integer.parseInt(text);
        if (value <= 0) {
            throw new IllegalArgumentException("value must be positive");
        }
        return value;
    } catch (NumberFormatException e) {
        throw new IllegalArgumentException("not a valid integer: " + text, e);
    }
}
```

예외를 비워 둔 catch로 삼키면 장애 원인을 잃는다. 처리할 수 없다면 의미 있는 예외로 변환하면서 원인 예외를 보존한다.

### try-with-resources

`AutoCloseable`을 구현한 자원은 try-with-resources로 닫는다.

```java
import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

static long countLines(Path path) throws Exception {
    try (BufferedReader reader = Files.newBufferedReader(
            path, StandardCharsets.UTF_8)) {
        long count = 0;
        while (reader.readLine() != null) {
            count++;
        }
        return count;
    }
}
```

정상 종료뿐 아니라 예외가 발생해도 자원이 닫힌다. 실무에서는 지나치게 넓은 `throws Exception`보다 실제 발생 가능한 예외를 선언하거나 계층 경계에서 변환한다.

## 람다, Stream과 Optional

### 함수형 인터페이스와 람다

추상 메서드가 하나인 인터페이스는 람다로 구현할 수 있다.

```java
import java.util.function.Predicate;

Predicate<String> isLongName = name -> name.length() >= 5;
System.out.println(isLongName.test("Java")); // false
```

표준 함수형 인터페이스에는 `Predicate<T>`, `Function<T, R>`, `Consumer<T>`, `Supplier<T>` 등이 있다.

### Stream pipeline

```java
List<String> result = students.stream()
    .filter(student -> student.score() >= 90)
    .sorted(Comparator.comparingInt(Student::score).reversed())
    .map(Student::name)
    .distinct()
    .toList();
```

stream은 데이터를 저장하는 자료구조가 아니라 데이터 처리 흐름이다.

1. source에서 stream을 만든다.
2. `filter`, `map`, `sorted` 같은 중간 연산을 연결한다.
3. `toList`, `collect`, `reduce`, `count` 같은 최종 연산으로 실행한다.

무조건 stream이 좋은 것은 아니다. 복잡한 상태 변경, 예외 처리, 여러 갈래의 제어 흐름은 일반 반복문이 더 읽기 쉬울 수 있다. 성능이 중요하면 추측하지 말고 측정해야 하며, `parallelStream`도 작업 특성과 실행 환경을 검토한 뒤 사용한다.

### 그룹화와 집계

```java
Map<Integer, Long> countByScore = students.stream()
    .collect(Collectors.groupingBy(
        Student::score,
        Collectors.counting()
    ));
```

`Collectors.groupingBy`는 SQL의 `GROUP BY`와 비슷한 형태로 데이터를 묶는다.

### Optional

```java
Optional<Student> topStudent = students.stream()
    .max(Comparator.comparingInt(Student::score));

String topName = topStudent
    .map(Student::name)
    .orElse("없음");
```

`Optional`은 결과가 없을 수 있음을 반환형에 표현한다. 모든 필드나 매개변수를 Optional로 만드는 용도는 아니며, `get()`을 바로 호출하면 존재 여부를 표현한 장점이 사라진다.

## 파일, 날짜와 시간

### `Path`와 `Files`

```java
Path path = Path.of("data", "users.txt");

Files.createDirectories(path.getParent());
Files.writeString(path, "Kim\nLee\n", StandardCharsets.UTF_8);

List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
```

큰 파일을 `readAllLines`로 읽으면 전체가 메모리에 올라간다. 대용량 데이터는 `Files.lines`나 `BufferedReader`로 한 줄씩 처리하되 stream이나 reader를 반드시 닫아야 한다.

### 날짜와 시간대

```java
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

LocalDate birthday = LocalDate.of(2001, 5, 10);
Instant occurredAt = Instant.now();
ZonedDateTime tokyoTime = occurredAt.atZone(ZoneId.of("Asia/Tokyo"));
```

- 날짜만 필요하면 `LocalDate`를 사용한다.
- 절대적인 발생 시점은 `Instant`로 저장하기 좋다.
- 사용자의 지역 시간 표현에는 `ZoneId`와 `ZonedDateTime`을 사용한다.

서버의 기본 시간대에 무심코 의존하면 배포 환경에 따라 결과가 달라질 수 있다.

## 동시성 기초

### ExecutorService 사용하기

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
    Future<Integer> future = executor.submit(() -> 20 + 22);
    System.out.println(future.get());
}
```

직접 스레드를 계속 생성하기보다 executor에 작업을 제출하면 스레드 수와 종료를 관리하기 쉽다. 위 try-with-resources 형태는 최신 Java의 `ExecutorService`에서 사용할 수 있다.

### 경쟁 상태

다음 증가는 하나의 원자적 연산이 아니다.

```java
count++; // 읽기 → 더하기 → 쓰기
```

여러 스레드가 동시에 실행하면 증가가 사라질 수 있다. 간단한 카운터에는 `AtomicInteger`를 사용할 수 있다.

```java
AtomicInteger count = new AtomicInteger();
count.incrementAndGet();
```

여러 값이 함께 만족해야 하는 불변식은 `synchronized`, `Lock`, 스레드 안전 컬렉션 또는 메시지 전달 방식으로 보호한다. `volatile`은 가시성에는 도움을 주지만 `count++` 같은 복합 연산을 원자적으로 만들지 않는다.

## 알고리즘을 배우기 전에: 시간과 공간 복잡도

| 복잡도 | 증가 형태 | 예시 |
| --- | --- | --- |
| O(1) | 입력 크기와 무관 | 배열 인덱스 접근 |
| O(log n) | 입력이 배로 늘어도 조금 증가 | 이진 검색 |
| O(n) | 입력 크기에 비례 | 선형 검색 |
| O(n log n) | 효율적인 비교 정렬 | 병합 정렬 |
| O(n²) | 이중 반복 | 단순 정렬, 모든 쌍 비교 |
| O(2ⁿ) | 부분집합을 전부 탐색 | 단순 백트래킹 |

시간 복잡도만 보지 말고 추가 메모리, 구현 복잡도, 입력 크기와 데이터 특성도 함께 고려한다. 표준 라이브러리가 제공하는 정렬과 자료구조는 검증된 구현이므로 실무에서는 직접 구현보다 우선한다. 직접 구현은 원리를 이해하기 위한 학습 과정이다.

## 탐색 알고리즘

### 선형 검색

```java
static int linearSearch(int[] values, int target) {
    for (int i = 0; i < values.length; i++) {
        if (values[i] == target) {
            return i;
        }
    }
    return -1;
}
```

처음부터 하나씩 확인하므로 정렬되지 않은 데이터에도 사용할 수 있고 시간 복잡도는 O(n)이다.

### 이진 검색

```java
static int binarySearch(int[] sorted, int target) {
    int left = 0;
    int right = sorted.length - 1;

    while (left <= right) {
        int mid = left + (right - left) / 2;

        if (sorted[mid] == target) {
            return mid;
        }
        if (sorted[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return -1;
}
```

이진 검색은 **정렬된 데이터**에서만 사용할 수 있다. 탐색 범위를 절반씩 줄이므로 O(log n)이다. 중간 인덱스를 `(left + right) / 2` 대신 `left + (right - left) / 2`로 계산하면 큰 정수에서 덧셈 overflow를 피할 수 있다.

## 정렬 알고리즘

### 삽입 정렬

```java
static void insertionSort(int[] values) {
    for (int i = 1; i < values.length; i++) {
        int current = values[i];
        int j = i - 1;

        while (j >= 0 && values[j] > current) {
            values[j + 1] = values[j];
            j--;
        }
        values[j + 1] = current;
    }
}
```

앞부분을 정렬된 구간으로 유지하면서 현재 값을 맞는 위치에 삽입한다. 평균과 최악은 O(n²)이지만 데이터가 거의 정렬되어 있으면 빠르고 구현이 단순하다.

### 병합 정렬

```java
static void mergeSort(int[] values) {
    int[] buffer = new int[values.length];
    mergeSort(values, buffer, 0, values.length);
}

static void mergeSort(int[] values, int[] buffer, int start, int end) {
    if (end - start <= 1) {
        return;
    }

    int mid = start + (end - start) / 2;
    mergeSort(values, buffer, start, mid);
    mergeSort(values, buffer, mid, end);
    merge(values, buffer, start, mid, end);
}

static void merge(int[] values, int[] buffer,
                  int start, int mid, int end) {
    int left = start;
    int right = mid;
    int index = start;

    while (left < mid && right < end) {
        if (values[left] <= values[right]) {
            buffer[index++] = values[left++];
        } else {
            buffer[index++] = values[right++];
        }
    }
    while (left < mid) {
        buffer[index++] = values[left++];
    }
    while (right < end) {
        buffer[index++] = values[right++];
    }
    System.arraycopy(buffer, start, values, start, end - start);
}
```

배열을 나누고 정렬된 두 구간을 합친다. 시간 복잡도는 항상 O(n log n)이고 위 구현은 O(n)의 보조 배열을 사용한다.

실제 코드에서는 객체 배열에 `Arrays.sort`, 목록에 `List.sort`를 우선 사용한다.

## 스택과 큐 응용

### 괄호 검사

```java
static boolean isBalanced(String text) {
    Deque<Character> stack = new ArrayDeque<>();

    for (char ch : text.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') {
            stack.push(ch);
        } else if (ch == ')' || ch == ']' || ch == '}') {
            if (stack.isEmpty()) {
                return false;
            }
            char open = stack.pop();
            if (!matches(open, ch)) {
                return false;
            }
        }
    }
    return stack.isEmpty();
}

static boolean matches(char open, char close) {
    return (open == '(' && close == ')')
        || (open == '[' && close == ']')
        || (open == '{' && close == '}');
}
```

가장 최근에 열린 괄호가 먼저 닫혀야 하므로 LIFO 구조인 스택이 적합하다. 시간 O(n), 공간 O(n)이다.

### BFS를 이용한 최단 거리

가중치가 없는 그래프에서 BFS는 시작점으로부터 간선 수가 가장 적은 거리를 구할 수 있다.

```java
static int[] shortestDistances(List<List<Integer>> graph, int start) {
    int[] distance = new int[graph.size()];
    Arrays.fill(distance, -1);

    Deque<Integer> queue = new ArrayDeque<>();
    queue.offer(start);
    distance[start] = 0;

    while (!queue.isEmpty()) {
        int current = queue.poll();

        for (int next : graph.get(current)) {
            if (distance[next] != -1) {
                continue;
            }
            distance[next] = distance[current] + 1;
            queue.offer(next);
        }
    }
    return distance;
}
```

각 정점과 간선을 한 번씩 확인하므로 인접 리스트 기준 시간 복잡도는 O(V + E)다.

## 해시를 이용한 빈도 계산과 Two Sum

### 문자 빈도 계산

```java
static Map<Character, Integer> frequencies(String text) {
    Map<Character, Integer> counts = new HashMap<>();
    for (char ch : text.toCharArray()) {
        counts.merge(ch, 1, Integer::sum);
    }
    return counts;
}
```

`merge`는 key가 없으면 1을 저장하고, 있으면 기존 값과 1을 더한다.

### Two Sum

두 수의 합이 목표값이 되는 인덱스를 찾는다.

```java
static int[] twoSum(int[] values, int target) {
    Map<Integer, Integer> indexByValue = new HashMap<>();

    for (int i = 0; i < values.length; i++) {
        int needed = target - values[i];
        Integer otherIndex = indexByValue.get(needed);
        if (otherIndex != null) {
            return new int[] {otherIndex, i};
        }
        indexByValue.put(values[i], i);
    }
    return new int[0];
}
```

모든 쌍을 비교하면 O(n²)이지만, 이전 값의 인덱스를 HashMap에 저장하면 평균 O(n)에 해결할 수 있다. `target - values[i]`의 정수 overflow 가능성이 요구사항상 문제가 되는지도 확인해야 한다.

## 수학과 누적 계산 알고리즘

### 최대공약수: 유클리드 호제법

```java
static int gcd(int a, int b) {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b != 0) {
        int remainder = a % b;
        a = b;
        b = remainder;
    }
    return a;
}
```

단, `Math.abs(Integer.MIN_VALUE)`는 양수 `int`로 표현할 수 없어 그대로 음수가 남는다. 모든 `int` 입력을 지원해야 한다면 `long`으로 올려 계산한다.

### 에라토스테네스의 체

```java
static List<Integer> primesUpTo(int limit) {
    if (limit < 2) {
        return List.of();
    }

    boolean[] composite = new boolean[limit + 1];
    for (int number = 2; number <= limit / number; number++) {
        if (composite[number]) {
            continue;
        }
        for (int multiple = number * number;
             multiple <= limit;
             multiple += number) {
            composite[multiple] = true;
        }
    }

    List<Integer> primes = new ArrayList<>();
    for (int number = 2; number <= limit; number++) {
        if (!composite[number]) {
            primes.add(number);
        }
    }
    return primes;
}
```

여러 수의 소수 여부를 한꺼번에 구할 때 효율적이다. `number * number <= limit` 대신 `number <= limit / number`를 사용해 곱셈 overflow를 피했다.

### 누적 합

```java
static long[] prefixSums(int[] values) {
    long[] prefix = new long[values.length + 1];
    for (int i = 0; i < values.length; i++) {
        prefix[i + 1] = prefix[i] + values[i];
    }
    return prefix;
}

static long rangeSum(long[] prefix, int from, int toExclusive) {
    return prefix[toExclusive] - prefix[from];
}
```

전처리에 O(n)이 들지만 이후 `[from, toExclusive)` 구간 합을 O(1)에 구할 수 있다. Java API처럼 끝 인덱스를 포함하지 않는 반열린 구간을 사용하면 길이는 `toExclusive - from`이 된다.

## 동적 계획법

동적 계획법은 겹치는 작은 문제의 답을 저장해 같은 계산을 반복하지 않는 방법이다.

### 계단 오르기

한 번에 1칸 또는 2칸을 오를 때 `n`칸에 도달하는 방법 수를 구한다.

```java
static long countWays(int n) {
    if (n < 0) {
        throw new IllegalArgumentException("n must be non-negative");
    }
    if (n <= 1) {
        return 1;
    }

    long previousTwo = 1; // dp[0]
    long previousOne = 1; // dp[1]

    for (int step = 2; step <= n; step++) {
        long current = Math.addExact(previousOne, previousTwo);
        previousTwo = previousOne;
        previousOne = current;
    }
    return previousOne;
}
```

점화식은 `dp[n] = dp[n - 1] + dp[n - 2]`다. 배열 전체가 아니라 직전 두 값만 필요하므로 공간을 O(1)로 줄였다. 경우의 수는 빠르게 증가해 `long`도 넘칠 수 있으며 `Math.addExact`가 overflow를 예외로 알려 준다.

## 응용 예제: 작은 주문 관리 프로그램

지금까지 배운 객체, 컬렉션, 예외와 stream을 하나의 예제에 연결해 보자.

### 도메인 객체

```java
import java.util.List;

record Product(long id, String name, int price) {
    Product {
        if (id <= 0 || name == null || name.isBlank() || price < 0) {
            throw new IllegalArgumentException("invalid product");
        }
    }
}

record OrderLine(Product product, int quantity) {
    OrderLine {
        if (product == null || quantity <= 0) {
            throw new IllegalArgumentException("invalid order line");
        }
    }

    long subtotal() {
        return Math.multiplyExact((long) product.price(), quantity);
    }
}

record Order(long id, List<OrderLine> lines) {
    Order {
        if (id <= 0 || lines == null || lines.isEmpty()) {
            throw new IllegalArgumentException("invalid order");
        }
        lines = List.copyOf(lines);
    }

    long totalPrice() {
        return lines.stream()
            .mapToLong(OrderLine::subtotal)
            .reduce(0L, Math::addExact);
    }
}
```

생성 시점에 규칙을 검사해 잘못된 객체가 만들어지지 않게 한다. `List.copyOf`로 외부에서 전달한 목록과의 연결을 끊고 수정 불가능한 목록으로 보관한다.

### 저장소 인터페이스와 메모리 구현

```java
interface OrderRepository {
    void save(Order order);
    Optional<Order> findById(long id);
    List<Order> findAll();
}

final class MemoryOrderRepository implements OrderRepository {
    private final Map<Long, Order> orders = new HashMap<>();

    @Override
    public void save(Order order) {
        if (orders.putIfAbsent(order.id(), order) != null) {
            throw new IllegalStateException("duplicate order: " + order.id());
        }
    }

    @Override
    public Optional<Order> findById(long id) {
        return Optional.ofNullable(orders.get(id));
    }

    @Override
    public List<Order> findAll() {
        return List.copyOf(orders.values());
    }
}
```

서비스가 Map 구현에 직접 의존하지 않고 저장소 인터페이스에 의존한다. 나중에 JDBC나 JPA 구현으로 교체해도 서비스의 핵심 규칙을 유지할 수 있다.

### 서비스 계층

```java
final class OrderService {
    private final OrderRepository repository;

    OrderService(OrderRepository repository) {
        this.repository = Objects.requireNonNull(repository);
    }

    void placeOrder(Order order) {
        if (order.totalPrice() == 0) {
            throw new IllegalArgumentException("free order is not allowed");
        }
        repository.save(order);
    }

    long totalSales() {
        return repository.findAll().stream()
            .mapToLong(Order::totalPrice)
            .reduce(0L, Math::addExact);
    }
}
```

```java
Product keyboard = new Product(1, "Keyboard", 50_000);
Order order = new Order(1001, List.of(new OrderLine(keyboard, 2)));

OrderService service = new OrderService(new MemoryOrderRepository());
service.placeOrder(order);

System.out.println(order.totalPrice()); // 100000
System.out.println(service.totalSales());
```

실제 애플리케이션이라면 재고 차감과 주문 저장을 트랜잭션으로 묶고, 금액 단위, 할인, 세금, 주문 상태와 동시성 규칙을 더해야 한다. 이 예제의 목적은 문법 요소가 역할 분리와 데이터 규칙으로 연결되는 과정을 보여 주는 것이다.

## 테스트하는 습관

JUnit을 사용하면 입력과 예상 결과를 코드로 남길 수 있다.

```java
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class AlgorithmsTest {
    @Test
    void findsValueWithBinarySearch() {
        int[] values = {1, 3, 5, 7, 9};
        assertEquals(3, binarySearch(values, 7));
        assertEquals(-1, binarySearch(values, 8));
    }

    @Test
    void sortsWithMergeSort() {
        int[] values = {5, 1, 4, 2, 3};
        mergeSort(values);
        assertArrayEquals(new int[] {1, 2, 3, 4, 5}, values);
    }
}
```

알고리즘은 정상 사례뿐 아니라 다음 경계값도 확인한다.

- 빈 배열과 원소가 하나인 배열
- 중복된 값
- 이미 정렬된 배열과 역순 배열
- 음수와 최댓값·최솟값
- 찾는 값이 없거나 처음·마지막에 있는 경우
- null을 허용하는지 여부

## 자주 하는 실수

### null을 무조건 허용하기

null 가능성은 API 경계에서 명확히 정한다. 필수 값은 생성자에서 검사하고, 결과가 없을 수 있으면 빈 컬렉션이나 Optional을 고려한다. 무분별한 null 검사는 문제를 늦게 발견하게 만든다.

### 예외로 일반 흐름 제어하기

반복문이 끝나는 조건이나 값의 존재 여부처럼 예상 가능한 상황을 예외로 처리하면 의도가 흐려지고 비용도 생긴다. 예외는 정상 흐름에서 벗어난 실패를 표현한다.

### 모든 것을 상속으로 해결하기

상속은 부모의 구현과 계약에 강하게 묶인다. ‘~이다’ 관계와 치환 가능성이 분명하지 않다면 작은 객체를 조합하고 인터페이스로 역할을 나누는 편이 안전하다.

### 컬렉션 구현을 습관적으로 선택하기

순서, 중복, 검색 방식, 변경 빈도에 따라 자료구조를 선택한다. 인덱스 접근이 많은데 `LinkedList`를 사용하거나, 정렬이 필요 없는데 `TreeMap`을 사용하면 의도와 성능이 맞지 않는다.

### stream 안에서 외부 상태 변경하기

```java
List<String> names = new ArrayList<>();
students.stream().forEach(student -> names.add(student.name()));
```

이런 코드는 병렬 처리에서 안전하지 않고 의도도 분산된다. 다음처럼 결과를 반환하게 작성한다.

```java
List<String> names = students.stream()
    .map(Student::name)
    .toList();
```

### 시간 복잡도를 무시하기

작은 입력에서는 O(n²)도 충분히 빠를 수 있다. 그러나 데이터가 커질 가능성이 있다면 반복문 안의 선형 검색을 HashSet 조회로 바꾸는 것만으로 O(n²)을 평균 O(n)으로 줄일 수 있다.

## 추천 학습 순서

1. 변수, 자료형, 조건문과 반복문을 직접 실행한다.
2. 배열과 문자열 문제를 반복문으로 해결한다.
3. 메서드로 입력·출력과 책임을 나눈다.
4. 클래스, 캡슐화, 인터페이스와 다형성을 익힌다.
5. List, Set, Map, Queue의 선택 기준과 복잡도를 공부한다.
6. 예외 처리와 파일 입출력으로 작은 프로그램을 만든다.
7. 제네릭, 람다와 stream으로 기존 코드를 개선한다.
8. 탐색, 정렬, 스택, 큐, 해시, 그래프와 DP를 구현한다.
9. JUnit으로 정상·경계·실패 사례를 자동화한다.
10. JDBC나 Spring Boot로 DB와 HTTP API까지 확장한다.

문법을 한 번 읽은 뒤 바로 큰 프레임워크로 넘어가기보다, 작은 콘솔 프로젝트를 완성해 보는 것이 좋다. 학생 성적 관리, 도서 대여, 주문·재고 관리처럼 입력·검증·저장·조회·정렬이 모두 필요한 주제가 연습에 적합하다.

{{< conclusion >}}
**결론:** Java의 기초는 변수와 제어문에서 시작하지만 실무 코드의 품질은 객체의 유효한 상태를 지키고, 역할을 인터페이스로 분리하며, 문제에 맞는 컬렉션과 알고리즘을 선택하는 데서 결정된다. 예제 코드를 직접 실행하고 경계값 테스트를 추가한 뒤, 같은 문제를 반복문·컬렉션·stream으로 각각 풀어 보면 문법과 설계가 자연스럽게 연결된다.
{{< /conclusion >}}

## 참고 자료

- [Dev.java - Learn Java](https://dev.java/learn/)
- [Dev.java - Java Language Basics](https://dev.java/learn/language-basics/)
- [Dev.java - Objects, Classes, Interfaces, Packages, and Inheritance](https://dev.java/learn/oop/)
- [Dev.java - Collections Framework](https://dev.java/learn/api/collections-framework/)
- [Java SE 25 API Documentation](https://docs.oracle.com/en/java/javase/25/docs/api/)
- [Java Language Specification, Java SE 25 Edition](https://docs.oracle.com/javase/specs/jls/se25/html/)
- [OpenJDK](https://openjdk.org/)
