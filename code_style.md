# Code Style Guide

> **Philosophy**: Code is read 10x more than written. Optimize for the reader.

---

## I. SIMPLICITY FIRST

### The Golden Rule

```
The best code is code that doesn't exist.
The second best is code that's obvious.
```

### Complexity Checklist

Before adding any abstraction, answer YES to all:
- [ ] Does this solve a problem that exists TODAY?
- [ ] Is this the simplest solution?
- [ ] Will a new team member understand this in 30 seconds?

If any answer is NO → simplify.

---

## II. NAMING

### Variables

```
// ❌ Cryptic
int d; // elapsed time in days
List<User> list;
boolean flag;

// ✅ Self-documenting
int elapsedDays;
List<User> activeUsers;
boolean isEligibleForDiscount;
```

### Functions

```
// ❌ Vague
void process();
void handle(Data d);
void doStuff();

// ✅ Intent-revealing (verb + noun)
void calculateMonthlyRevenue();
void sendWelcomeEmail(User user);
void validatePaymentDetails(Payment payment);
```

### Booleans

Always phrase as yes/no questions:
```
isValid, hasPermission, canExecute, shouldRetry
```

---

## III. FUNCTIONS

### Size

- **Target**: 5-15 lines
- **Maximum**: 30 lines (if exceeded, extract)
- **One level of abstraction** per function

### Single Responsibility

```
// ❌ Does too much
void processOrder(Order order) {
    validate(order);
    calculateTax(order);
    applyDiscount(order);
    saveToDatabase(order);
    sendConfirmationEmail(order);
    updateInventory(order);
}

// ✅ Orchestrates single-purpose functions
void processOrder(Order order) {
    Order validated = orderValidator.validate(order);
    Order priced = pricingService.applyPricing(validated);
    orderRepository.save(priced);
    notificationService.confirmOrder(priced);
}
```

### Parameters

- **Ideal**: 0-2 parameters
- **Maximum**: 3 parameters
- **More than 3?** → Create a parameter object

### Return Early

```
// ❌ Nested conditionals
void process(Request req) {
    if (req != null) {
        if (req.isValid()) {
            if (hasPermission(req)) {
                // actual logic buried here
            }
        }
    }
}

// ✅ Guard clauses
void process(Request req) {
    if (req == null) return;
    if (!req.isValid()) return;
    if (!hasPermission(req)) return;
    
    // actual logic at main indentation
}
```

---

## IV. ERROR HANDLING

### Fail Fast

Validate inputs at boundaries. Don't pass invalid data deep into the system.

### Specific Exceptions

```
// ❌ Generic
throw new RuntimeException("Something went wrong");

// ✅ Specific and actionable
throw new PaymentDeclinedException(orderId, reason);
```

### Never Swallow Errors

```
// ❌ Silent failure
try {
    process();
} catch (Exception e) {
    // TODO: handle later
}

// ✅ At minimum, log
try {
    process();
} catch (ProcessingException e) {
    logger.error("Processing failed for id={}", id, e);
    throw e;
}
```

---

## V. COMMENTS

### When to Comment

```
// ✅ WHY (intent, business reason)
// Retry 3x because payment gateway has 2% transient failure rate

// ✅ WARNING
// Order matters: tax must be calculated before discount

// ❌ WHAT (the code already says this)
// Loop through users
for (User user : users) { ... }

// ❌ Apology
// This is hacky but works
```

### The Best Comment

Is the one you didn't need to write because the code was clear.

---

## VI. STRUCTURE

### File Organization

```
1. Constants / Configuration
2. Dependencies (injected)
3. Public methods (API surface)
4. Private methods (implementation details)
```

### Vertical Proximity

Related code stays together:
- Caller above callee
- Variable declaration near first use

### Horizontal Limits

- **Line length**: ≤ 120 characters
- **Indentation depth**: ≤ 3 levels (extract if deeper)

---

## VII. TESTABILITY BY DESIGN

### Dependency Injection

```
// ❌ Hard to test (hidden dependency)
class OrderService {
    void process(Order o) {
        Database db = Database.getInstance();
        db.save(o);
    }
}

// ✅ Testable (explicit dependency)
class OrderService {
    private final OrderRepository repository;
    
    OrderService(OrderRepository repository) {
        this.repository = repository;
    }
    
    void process(Order o) {
        repository.save(o);
    }
}
```

### Pure Functions Where Possible

```
// ✅ No side effects, deterministic
int calculateDiscount(int price, int discountPercent) {
    return price * discountPercent / 100;
}
```

### Avoid Static Methods

Except for pure utility functions with no dependencies.

---

## VIII. PERFORMANCE

### When to Optimize

```
Never optimize without measurement.

Before optimizing, verify:
□ Measurable user impact exists
□ Profiling identifies the bottleneck
□ Algorithmic improvements exhausted
□ Cost/benefit justified (hours saved vs. hours spent)
```

### The Optimization Hierarchy

```
1. Choose right algorithm (O(n) vs O(n²))
2. Reduce I/O operations (batch, cache)
3. Optimize hot paths (profile-guided)
4. Micro-optimize (last resort)
```

### Big O Guidelines

| Complexity | Acceptable When | Warning |
|------------|-----------------|---------|
| O(1), O(log n) | Always | Perfect |
| O(n) | Always | Standard |
| O(n log n) | n < 10,000 | Good enough |
| O(n²) | n < 100 | Careful |
| O(n²) | n > 100 | Needs optimization |
| O(2ⁿ), O(n!) | Never in production | Redesign |

### Common Wins

```javascript
// ❌ O(n²) - nested array search
users.forEach(user => {
    const order = orders.find(o => o.userId === user.id);
});

// ✅ O(n) - use Map for lookups
const ordersByUser = new Map(orders.map(o => [o.userId, o]));
users.forEach(user => {
    const order = ordersByUser.get(user.id);
});
```

### Premature Optimization

> "Premature optimization is the root of all evil" - Donald Knuth

Write clear code first. Profile. Then optimize if needed.

---

## IX. ANTI-PATTERNS TO AVOID

| Anti-Pattern | Why It's Bad | Instead |
|--------------|--------------|---------|
| God Class | Too many responsibilities | Split by domain |
| Primitive Obsession | `String email` everywhere | Value objects: `Email` |
| Feature Envy | Method uses other class's data | Move method to that class |
| Magic Numbers | `if (status == 3)` | Named constants |
| Deep Nesting | Hard to follow | Guard clauses, extract |
| Long Parameter Lists | Hard to use correctly | Parameter objects |

---

## X. LOGGING STANDARDS

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **ERROR** | Unrecoverable failure | "Payment processing failed for order #123" |
| **WARN** | Recoverable issue, degraded state | "Cache miss, falling back to DB" |
| **INFO** | Significant business events | "User logged in", "Order completed" |
| **DEBUG** | Developer diagnostics | "Entering function with params: {...}" |

### What to Log

```javascript
// ✅ Log meaningful events
logger.info('User authentication succeeded', { userId, method: 'oauth' });
logger.error('Payment failed', { orderId, reason, amount }, error);

// ❌ Don't log noise
logger.debug('Entering function');  // Use debugger instead
logger.info('Variable x is 5');      // Too granular
```

### Security: Never Log

```
⛔ Passwords, API keys, tokens
⛔ Credit card numbers, CVV
⛔ Personal data (emails, phone numbers) in production
⛔ Full stack traces to users (sanitize first)
```

### Structured Logging

```javascript
// ✅ Structured (easy to query)
logger.info('Order processed', {
    orderId: order.id,
    userId: user.id,
    amount: order.total,
    durationMs: 234
});

// ❌ Unstructured (hard to parse)
logger.info(`Order ${order.id} for user ${user.id} processed in 234ms`);
```

### Context Correlation

```javascript
// ✅ Include request/correlation ID
logger.info('Processing payment', { requestId, orderId });
logger.error('Payment failed', { requestId, orderId, reason });
// Makes it easy to trace full request lifecycle
```

---

*Simple. Clear. Correct.*
