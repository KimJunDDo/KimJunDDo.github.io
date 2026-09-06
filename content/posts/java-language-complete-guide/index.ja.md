---
title: "Javaを一度に学ぶ：基礎文法からオブジェクト指向、コレクションとアルゴリズムまで"
date: 2026-09-06
draft: false
description: "Javaの実行構造と基礎文法から、オブジェクト指向、ジェネリクス、コレクション、例外、Stream、ファイル処理、並行処理、基本アルゴリズムの実装までを詳しく解説します。"
tags: ["Java", "Programming Basics", "OOP", "Collection", "Data Structure", "Algorithm"]
categories: ["Java"]
showTableOfContents: true
---

Javaは、バックエンドサーバー、Android、企業向けシステム、バッチプログラム、各種ツールの開発に使われる汎用プログラミング言語である。文法を覚えるだけなら難しくないが、オブジェクトの責務を分け、コレクションと例外を正しく使い、問題に合うアルゴリズムを選ぶには基礎となる原理も理解する必要がある。

この記事は、Javaを初めて学ぶ人が上から順に読み進められるよう構成した。変数と制御文から始め、オブジェクト指向、ジェネリクス、コレクション、ラムダ式とStream、ファイル処理、並行処理へ進む。最後に探索・ソート・スタック・キュー・ハッシュ・グラフ・動的計画法を直接実装し、学んだ内容を小さな注文管理プログラムへ応用する。

サンプルは**Java 21以降**を基準にしている。`record`、switch式、パターンマッチングなど比較的新しい文法についても、必要になる理由から説明する。

{{< conclusion >}}
**要点:** Javaを使いこなすために重要なのは、文法を数多く暗記することではない。**値と参照の違い、オブジェクトの責務、インターフェースによる抽象化、コレクションの計算量、例外とリソースの寿命**を理解し、問題に適した構造を選ぶことである。
{{< /conclusion >}}

## Javaプログラムが実行される仕組み

### JDK、JVM、バイトコード

Javaのソースファイルは、そのままCPU命令になるわけではない。`javac`コンパイラが`.java`ファイルをJVM用のバイトコードである`.class`ファイルへ変換し、JVMがそれを実行する。

```text
Main.java → javac → Main.class → JVM → OSとCPU
```

- **JDK（Java Development Kit）:** コンパイラ、実行ツール、デバッガ、標準ライブラリを含む開発環境である。
- **JVM（Java Virtual Machine）:** バイトコードを実行し、メモリとガベージコレクションを管理する。
- **JRE（Java Runtime Environment）:** Javaプログラムの実行に必要なJVMとライブラリを表してきた配布上の概念である。現在は`jlink`などで必要なランタイムを構成することもできる。

プラットフォームごとにJVM実装は異なるが、同じバイトコードを実行できるためJavaは高い移植性を持つ。ただし、ファイルパス、デフォルト文字エンコーディング、ネイティブライブラリなどOSに依存する部分まで自動的に同じになるわけではない。

### 最初のプログラム

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
```

ファイル名は`public class`と同じ`Main.java`にする。

```bash
javac Main.java
java Main
```

`main`はプログラムの開始点である。`public`なのでJVMからアクセスでき、`static`なので`Main`オブジェクトを生成せずに呼び出せる。`String[] args`にはコマンドライン引数が渡される。

## 変数、データ型、演算子

### プリミティブ型と参照型

Javaの型は大きくプリミティブ型と参照型に分かれる。

| 分類 | 型 | 説明 |
| --- | --- | --- |
| 論理 | `boolean` | `true`または`false` |
| 整数 | `byte`, `short`, `int`, `long` | 大きさの異なる符号付き整数 |
| 文字 | `char` | UTF-16コード単位一つ |
| 浮動小数点 | `float`, `double` | IEEE 754浮動小数点数 |
| 参照型 | 配列、クラス、インターフェース、`String` | オブジェクトを指す参照 |

```java
int age = 25;
long population = 51_000_000L;
double temperature = 23.5;
boolean active = true;
char grade = 'A';
String name = "Kim";
```

数値内の`_`は読みやすくする区切りである。`long`リテラルには`L`、`float`リテラルには`F`を付ける。

ローカル変数は使用前に必ず初期化しなければならない。オブジェクトのフィールドには`0`、`false`、`null`などの初期値が入るが、初期値へ無意識に依存せず、コンストラクタで有効な状態を作るほうがよい。

### 値のコピーと参照値のコピー

Javaの引数渡しは常に**値渡し（pass by value）**である。プリミティブ型では値そのものがコピーされ、オブジェクト変数ではオブジェクトを指す参照値がコピーされる。

```java
static void rename(StringBuilder builder) {
    builder.append(" DDo");       // 同じオブジェクトの状態を変更する。
    builder = new StringBuilder(); // コピーされたローカル参照だけが変わる。
}

StringBuilder name = new StringBuilder("Jun");
rename(name);
System.out.println(name); // Jun DDo
```

メソッド内で参照変数を別のオブジェクトへ変更しても、呼び出し元の変数は変わらない。一方、二つの参照が同じ可変オブジェクトを指していれば、そのオブジェクトへの変更は呼び出し元からも見える。

### 型変換

小さい整数型から大きい整数型への変換は自動で行えるが、情報が失われる可能性のある変換は明示する。

```java
int count = 10;
long total = count;

double price = 19.9;
int truncated = (int) price; // 19
```

金額には`double`より`BigDecimal`が適する。

```java
import java.math.BigDecimal;

BigDecimal price = new BigDecimal("19.90");
BigDecimal quantity = BigDecimal.valueOf(3);
BigDecimal totalPrice = price.multiply(quantity);
```

`new BigDecimal(0.1)`は、すでに近似された`double`を受け取るため避け、文字列または`BigDecimal.valueOf`を使う。

### 主な演算子

```java
int sum = 3 + 2;
int remainder = 7 % 3;
boolean adult = age >= 18;
boolean allowed = active && adult;
int max = (a > b) ? a : b;
```

`&&`と`||`は、結果が決まると右辺を評価しない短絡評価を行う。

```java
if (user != null && user.isActive()) {
    // userがnullなら右側のメソッドは呼ばれない。
}
```

## 条件分岐と繰り返し

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

条件の順番は重要である。`score >= 80`を先に評価すると95点もBになる。79、80、89、90のような境界値をテストする。

### switch式

現在のJavaではswitchが値を返せる。

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

矢印構文は意図しないfall-throughを防ぐ。複数の文が必要ならブロック内で`yield`を使って値を返す。

### `for`、拡張`for`、`while`

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

インデックスが不要なら拡張for文が読みやすい。コレクションを走査中に直接構造を変更すると`ConcurrentModificationException`が発生し得るため、`Iterator.remove`、`removeIf`、または新しいコレクションを使う。

## 配列と文字列

### 配列

配列は同じ型の値を固定長で保存する。

```java
int[] numbers = {4, 2, 7, 1};
System.out.println(numbers.length);

for (int i = 0; i < numbers.length; i++) {
    numbers[i] *= 2;
}
```

インデックスは`0`から`length - 1`までである。範囲を外れると`ArrayIndexOutOfBoundsException`が発生する。2次元配列では行ごとに異なる長さを持つこともできる。

```java
int[][] triangle = {
    {1},
    {2, 3},
    {4, 5, 6}
};
```

### `String`は不変オブジェクト

```java
String original = "Java";
String upper = original.toUpperCase();

System.out.println(original); // Java
System.out.println(upper);    // JAVA
```

文字列のメソッドは元の文字列を変更せず、新しい文字列を返す。ループ内で`+`による結合を繰り返すと中間オブジェクトが増えるため、`StringBuilder`を使う。

```java
StringBuilder builder = new StringBuilder();
for (int i = 1; i <= 3; i++) {
    if (i > 1) {
        builder.append(", ");
    }
    builder.append(i);
}
String result = builder.toString();
```

### `==`と`equals`

参照型の`==`は同じオブジェクトを指すかを比較し、`equals`はオブジェクトが定義した論理的な同値性を比較する。

```java
String a = new String("java");
String b = new String("java");

System.out.println(a == b);      // false
System.out.println(a.equals(b)); // true
```

文字列や値オブジェクトの内容を比較するときは`equals`を使う。nullの可能性があれば`Objects.equals(a, b)`が便利である。

## メソッドの設計

### 引数と戻り値

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

よいメソッドは一つの責務を持ち、名前から意図を推測できる。入力として許可する範囲と失敗時の振る舞いを明確にする。

### オーバーロードと可変長引数

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

同じ名前で引数リストが異なるメソッドを定義することをオーバーロードという。戻り値だけが異なるメソッドは定義できない。可変長引数は内部では配列として扱われ、引数リストの最後に一つだけ置ける。

### 再帰呼び出し

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

再帰には必ず終了条件が必要である。呼び出しが深すぎると`StackOverflowError`になるため、単純なループへ変更できないかも検討する。`long`で正確に表せる階乗は20!までである。

## クラスとオブジェクト指向

### クラス、フィールド、コンストラクタ

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

フィールドを`private`で隠し、オブジェクト自身が有効な状態を守ることをカプセル化という。残高を直接変更させず、入金と出金という意味のあるメソッドを提供すれば、規則を一か所で保証できる。

### アクセス修飾子

| アクセス修飾子 | 同じクラス | 同じパッケージ | サブクラス | すべての場所 |
| --- | --- | --- | --- | --- |
| `private` | O | X | X | X |
| package-private | O | O | X | X |
| `protected` | O | O | O | X |
| `public` | O | O | O | O |

必要な範囲だけを公開する。実装の詳細を外部へ公開するほど変更が難しくなる。

### `static`、`final`、不変性

- `static`フィールドとメソッドは特定のオブジェクトではなくクラスに属する。
- `final`変数には一度だけ代入できる。
- `final`メソッドはoverrideできず、`final`クラスは継承できない。

`final List<String>`は参照の再代入を禁止するだけで、リスト内部の変更までは防がない。不変リストが必要なら`List.copyOf`や`List.of`を使う。

### recordで値オブジェクトを作る

```java
public record Product(long id, String name, int price) {
    public Product {
        if (id <= 0 || name == null || name.isBlank() || price < 0) {
            throw new IllegalArgumentException("invalid product");
        }
    }
}
```

recordはデータ転送や値オブジェクトに必要なアクセサ、`equals`、`hashCode`、`toString`を自動生成する。ただし、コンポーネントに可変オブジェクトが含まれる場合、深い不変性まで自動で保証されるわけではない。

## 継承、抽象クラス、インターフェース

### 継承とポリモーフィズム

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

親型の変数で複数の子オブジェクトを扱い、実際のオブジェクトがoverrideしたメソッドを実行する仕組みがポリモーフィズムである。継承は強い結合を生むため、単なるコード再利用が目的ならオブジェクトの合成を先に検討する。

### インターフェースで役割を分ける

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

`NotificationService`はメールやSMSの具体的な送信方法を知らず、`MessageSender`という役割だけに依存する。そのため実装の交換やテスト用fakeの注入が容易になる。これは依存性逆転と依存性注入の基礎である。

## ジェネリクス

ジェネリクスは型をパラメータとして受け取り、コンパイル時の型安全性を高める。

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

### 境界付き型とワイルドカード

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

値を読むproducerには`? extends T`、値を入れるconsumerには`? super T`を使う**PECS（Producer Extends, Consumer Super）**で覚えられる。`List<Integer>`は`List<Number>`のサブタイプではない。

## Collections Framework

### List、Set、Map、Queueの選択

| データ構造 | 主な実装 | 特徴 | 主な計算量 |
| --- | --- | --- | --- |
| `List` | `ArrayList` | 順序と重複を許可 | 参照O(1)、途中挿入O(n) |
| `Set` | `HashSet` | 重複を除去 | 平均検索・挿入O(1) |
| ソート済みSet | `TreeSet` | ソート状態を維持 | 検索・挿入O(log n) |
| `Map` | `HashMap` | key-valueを保存 | 平均検索・挿入O(1) |
| ソート済みMap | `TreeMap` | key順を維持 | 検索・挿入O(log n) |
| `Queue` | `ArrayDeque` | FIFO処理 | 両端操作O(1) |
| 優先度キュー | `PriorityQueue` | 優先度順に処理 | 挿入・削除O(log n) |

Big-Oは入力が大きくなったときに処理量がどう増えるかを表す。ハッシュ構造のO(1)は平均的な場合であり、衝突や実装状態によって変わる。

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

スタック用途では古い`Stack`クラスより、`ArrayDeque`の`push`、`pop`、`peek`が一般的である。`HashMap`と`ArrayList`はスレッドセーフではないため、複数スレッドが同時に変更するなら同期またはconcurrent collectionが必要になる。

### `equals`と`hashCode`

`HashMap`と`HashSet`は`hashCode`で候補位置を探し、`equals`で論理的な同値性を確認する。`equals`で同じ二つのオブジェクトは、必ず同じ`hashCode`を返さなければならない。

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

ハッシュのkeyに使うオブジェクトでは、同値性に関係するフィールドを保存後に変更しないことが安全である。

### Comparatorによるソート

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

自然順序は`Comparable`、用途ごとのソート規則は`Comparator`で表す。上のコードは点数の降順、同点なら名前の昇順で並べる。

## 例外処理とリソース管理

### checked exceptionとunchecked exception

- `Exception`のうち`RuntimeException`ではない例外はchecked exceptionで、呼び出し側が処理するか`throws`で宣言する。
- `RuntimeException`とそのサブクラスはunchecked exceptionである。
- `Error`は通常、アプリケーションが捕捉して復旧しようとする対象ではない。

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

空のcatchで例外を無視すると障害原因を失う。処理できない場合は意味のある例外へ変換し、原因例外を保持する。

### try-with-resources

`AutoCloseable`を実装するリソースはtry-with-resourcesで閉じる。

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

正常終了時だけでなく例外時にもリソースが閉じられる。実務では広すぎる`throws Exception`より、実際に発生する例外を宣言するか、レイヤー境界で適切な例外へ変換する。

## ラムダ式、Stream、Optional

### 関数型インターフェースとラムダ式

抽象メソッドが一つのインターフェースはラムダ式で実装できる。

```java
import java.util.function.Predicate;

Predicate<String> isLongName = name -> name.length() >= 5;
System.out.println(isLongName.test("Java")); // false
```

標準関数型インターフェースには`Predicate<T>`、`Function<T, R>`、`Consumer<T>`、`Supplier<T>`などがある。

### Stream pipeline

```java
List<String> result = students.stream()
    .filter(student -> student.score() >= 90)
    .sorted(Comparator.comparingInt(Student::score).reversed())
    .map(Student::name)
    .distinct()
    .toList();
```

Streamはデータを保存する構造ではなく、データ処理の流れである。sourceから作成し、`filter`、`map`、`sorted`などの中間操作をつなぎ、`toList`、`collect`、`reduce`、`count`などの終端操作で実行する。

常にStreamが最適とは限らない。複雑な状態変更、例外処理、複数方向の制御フローは通常のループのほうが読みやすい。性能が重要なら推測ではなく測定し、`parallelStream`も処理の性質と実行環境を確認して使う。

### グループ化と集計

```java
Map<Integer, Long> countByScore = students.stream()
    .collect(Collectors.groupingBy(
        Student::score,
        Collectors.counting()
    ));
```

`Collectors.groupingBy`はSQLの`GROUP BY`に似た形でデータをまとめる。

### Optional

```java
Optional<Student> topStudent = students.stream()
    .max(Comparator.comparingInt(Student::score));

String topName = topStudent
    .map(Student::name)
    .orElse("なし");
```

`Optional`は結果が存在しない可能性を戻り値の型で表す。すべてのフィールドや引数をOptionalにするためのものではない。`get()`をすぐ呼ぶと、存在しない可能性を表した利点を失う。

## ファイル、日付、時刻

### `Path`と`Files`

```java
Path path = Path.of("data", "users.txt");

Files.createDirectories(path.getParent());
Files.writeString(path, "Kim\nLee\n", StandardCharsets.UTF_8);

List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
```

大きなファイルを`readAllLines`で読むと全体がメモリに載る。大容量データは`Files.lines`や`BufferedReader`で一行ずつ処理し、Streamまたはreaderを必ず閉じる。

### 日付とタイムゾーン

```java
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

LocalDate birthday = LocalDate.of(2001, 5, 10);
Instant occurredAt = Instant.now();
ZonedDateTime tokyoTime = occurredAt.atZone(ZoneId.of("Asia/Tokyo"));
```

- 日付だけなら`LocalDate`を使う。
- 絶対的な発生時点は`Instant`で保存しやすい。
- 利用者の地域時刻には`ZoneId`と`ZonedDateTime`を使う。

サーバーのデフォルトタイムゾーンへ無意識に依存すると、配布環境によって結果が変わる。

## 並行処理の基礎

### ExecutorServiceを使う

```java
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
    Future<Integer> future = executor.submit(() -> 20 + 22);
    System.out.println(future.get());
}
```

スレッドを直接作り続けるより、executorへタスクを渡すほうがスレッド数と終了を管理しやすい。このtry-with-resources形式は新しいJavaの`ExecutorService`で利用できる。

### 競合状態

次の増加処理は一つのアトミック操作ではない。

```java
count++; // 読み取り → 加算 → 書き込み
```

複数スレッドが同時に実行すると増加が失われることがある。単純なカウンタには`AtomicInteger`を使える。

```java
AtomicInteger count = new AtomicInteger();
count.incrementAndGet();
```

複数の値が同時に満たすべき不変条件は、`synchronized`、`Lock`、スレッドセーフなコレクション、メッセージ送信などで保護する。`volatile`は可視性を助けるが、`count++`のような複合操作をアトミックにはしない。

## アルゴリズムの前提：時間・空間計算量

| 計算量 | 増え方 | 例 |
| --- | --- | --- |
| O(1) | 入力サイズと無関係 | 配列のインデックス参照 |
| O(log n) | 入力が倍でも少し増加 | 二分探索 |
| O(n) | 入力サイズに比例 | 線形探索 |
| O(n log n) | 効率的な比較ソート | マージソート |
| O(n²) | 二重ループ | 単純ソート、全ペア比較 |
| O(2ⁿ) | 部分集合をすべて探索 | 単純なバックトラッキング |

時間計算量だけでなく、追加メモリ、実装の複雑さ、入力サイズ、データの性質も考慮する。実務では検証済みの標準ライブラリを優先し、直接実装する目的は原理の理解に置く。

## 探索アルゴリズム

### 線形探索

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

先頭から一つずつ確認するため、未ソートのデータにも使える。時間計算量はO(n)である。

### 二分探索

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

二分探索は**ソート済みのデータ**でのみ使える。探索範囲を半分ずつ減らすためO(log n)である。`left + (right - left) / 2`は大きな整数での加算overflowを避ける。

## ソートアルゴリズム

### 挿入ソート

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

前半をソート済み区間として保ち、現在値を正しい位置へ挿入する。平均・最悪はO(n²)だが、ほぼソート済みのデータでは速く、実装も単純である。

### マージソート

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
        buffer[index++] = values[left] <= values[right]
            ? values[left++] : values[right++];
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

配列を分割し、ソート済みの二つの区間を結合する。時間計算量は常にO(n log n)で、上の実装はO(n)の補助配列を使う。実際のコードでは配列に`Arrays.sort`、リストに`List.sort`を優先する。

## スタックとキューの応用

### 括弧の対応を検査する

```java
static boolean isBalanced(String text) {
    Deque<Character> stack = new ArrayDeque<>();

    for (char ch : text.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') {
            stack.push(ch);
        } else if (ch == ')' || ch == ']' || ch == '}') {
            if (stack.isEmpty() || !matches(stack.pop(), ch)) {
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

最後に開いた括弧から閉じる必要があるため、LIFO構造のスタックが適する。時間O(n)、空間O(n)である。

### BFSによる最短距離

重みのないグラフでは、BFSで開始点からの最小辺数を求められる。

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

隣接リストでは各頂点と辺を一度ずつ確認するため、時間計算量はO(V + E)である。

## ハッシュを使うアルゴリズム

### 文字の出現回数

```java
static Map<Character, Integer> frequencies(String text) {
    Map<Character, Integer> counts = new HashMap<>();
    for (char ch : text.toCharArray()) {
        counts.merge(ch, 1, Integer::sum);
    }
    return counts;
}
```

`merge`はkeyがなければ1を保存し、存在すれば既存値へ1を加える。

### Two Sum

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

全ペアの比較はO(n²)だが、過去の値とインデックスをHashMapへ保存すれば平均O(n)で解ける。要件によっては`target - values[i]`の整数overflowも検討する。

## 数学と累積計算

### 最大公約数：ユークリッドの互除法

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

`Math.abs(Integer.MIN_VALUE)`は正の`int`で表せず負のまま残る。すべての`int`入力へ対応するなら`long`へ拡張して計算する。

### エラトステネスの篩

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

多数の整数について素数かどうかをまとめて調べるときに効率的である。`number <= limit / number`として乗算overflowを避けている。

### 累積和

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

前処理はO(n)だが、以降は`[from, toExclusive)`の区間和をO(1)で求められる。Java APIと同じ半開区間を使うと、区間長は`toExclusive - from`になる。

## 動的計画法

動的計画法は、重複する小さな問題の答えを保存し、同じ計算を繰り返さない方法である。

### 階段の上り方

一度に1段または2段進むとき、`n`段へ到達する方法の数を求める。

```java
static long countWays(int n) {
    if (n < 0) {
        throw new IllegalArgumentException("n must be non-negative");
    }
    if (n <= 1) {
        return 1;
    }

    long previousTwo = 1;
    long previousOne = 1;

    for (int step = 2; step <= n; step++) {
        long current = Math.addExact(previousOne, previousTwo);
        previousTwo = previousOne;
        previousOne = current;
    }
    return previousOne;
}
```

漸化式は`dp[n] = dp[n - 1] + dp[n - 2]`である。直前の二つだけを保持して空間をO(1)にした。結果は急速に増えるため、`Math.addExact`で`long`のoverflowを検出する。

## 応用例：小さな注文管理プログラム

ここまで学んだオブジェクト、コレクション、例外、Streamを一つの例へつなげる。

### ドメインオブジェクト

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

生成時に規則を検証し、不正なオブジェクトが作られないようにする。`List.copyOf`で外部から渡されたリストとの接続を切り、変更不能なリストとして保持する。

### Repositoryインターフェースとメモリ実装

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

サービスはMapの実装へ直接依存せず、Repositoryインターフェースへ依存する。後からJDBCやJPA実装に交換しても、サービスの中心的な規則を維持できる。

### Serviceレイヤー

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

実際のアプリケーションでは、在庫減少と注文保存をトランザクションにまとめ、金額単位、割引、税、注文状態、並行処理の規則を追加する。この例の目的は、文法要素が役割分離とデータ規則へつながる過程を示すことである。

## テストする習慣

JUnitを使うと、入力と期待結果をコードとして残せる。

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

正常系だけでなく、空配列、要素一つ、重複値、ソート済みと逆順、負数、最大・最小値、対象がない場合、nullを許可するかといった境界も確認する。

## よくある間違い

### nullを無条件に許可する

nullの可能性はAPI境界で明確に決める。必須値はコンストラクタで検証し、結果がない場合は空コレクションやOptionalを検討する。無差別なnull検査は問題の発見を遅らせる。

### 例外を通常フローに使う

ループの終了や値の存在確認のような予測可能な状況を例外で表すと意図が分かりにくくなる。例外は通常フローから外れた失敗を表す。

### すべてを継承で解決する

継承は親の実装と契約へ強く結合する。「〜である」という関係と置換可能性が明確でなければ、小さなオブジェクトを組み合わせ、インターフェースで役割を分ける。

### コレクションを習慣だけで選ぶ

順序、重複、検索方法、変更頻度からデータ構造を選ぶ。インデックス参照が多いのに`LinkedList`を使ったり、順序が不要なのに`TreeMap`を使ったりすると意図と性能が合わない。

### Stream内で外部状態を変更する

```java
List<String> names = students.stream()
    .map(Student::name)
    .toList();
```

外部の可変リストへ`forEach`で追加するより、処理結果を返す形にするほうが意図が明確で並列処理でも安全にしやすい。

### 計算量を無視する

小さい入力ならO(n²)でも十分速い場合がある。しかしデータが増える可能性があれば、ループ内の線形探索をHashSet参照へ変えるだけでO(n²)を平均O(n)へ改善できる。

## 推奨する学習順序

1. 変数、型、条件分岐、ループを直接実行する。
2. 配列と文字列の問題をループで解く。
3. メソッドで入出力と責務を分ける。
4. クラス、カプセル化、インターフェース、ポリモーフィズムを学ぶ。
5. List、Set、Map、Queueの選択基準と計算量を理解する。
6. 例外処理とファイル入出力で小さなプログラムを作る。
7. ジェネリクス、ラムダ式、Streamで既存コードを改善する。
8. 探索、ソート、スタック、キュー、ハッシュ、グラフ、DPを実装する。
9. JUnitで正常・境界・失敗ケースを自動化する。
10. JDBCやSpring Bootを使い、DBとHTTP APIへ拡張する。

文法を一度読んですぐ大きなフレームワークへ進むより、小さなコンソールプロジェクトを完成させるとよい。成績管理、図書貸出、注文・在庫管理のように、入力・検証・保存・検索・ソートがすべて必要な題材が練習に適している。

{{< conclusion >}}
**結論:** Javaの基礎は変数と制御文から始まるが、実務コードの品質は、オブジェクトの有効な状態を守り、役割をインターフェースで分け、問題に合うコレクションとアルゴリズムを選ぶことで決まる。サンプルを直接実行して境界値テストを追加し、同じ問題をループ・コレクション・Streamで解き直すと、文法と設計を自然につなげられる。
{{< /conclusion >}}

## 参考資料

- [Dev.java - Learn Java](https://dev.java/learn/)
- [Dev.java - Java Language Basics](https://dev.java/learn/language-basics/)
- [Dev.java - Objects, Classes, Interfaces, Packages, and Inheritance](https://dev.java/learn/oop/)
- [Dev.java - Collections Framework](https://dev.java/learn/api/collections-framework/)
- [Java SE 25 API Documentation](https://docs.oracle.com/en/java/javase/25/docs/api/)
- [Java Language Specification, Java SE 25 Edition](https://docs.oracle.com/javase/specs/jls/se25/html/)
- [OpenJDK](https://openjdk.org/)
