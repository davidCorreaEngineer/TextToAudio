# Testing Patterns

> **Philosophy**: Test WHAT the code does, not HOW it does it.

---

## I. CORE PRINCIPLE

### Test Behavior, Not Implementation

```
// ❌ Testing implementation (brittle)
@Test
void shouldCallRepositorySaveMethod() {
    service.createUser(dto);
    verify(repository, times(1)).save(any(User.class));
}

// ✅ Testing behavior (resilient)
@Test
void createdUserCanBeRetrievedById() {
    UserId id = service.createUser(dto);
    
    User retrieved = service.getUser(id);
    
    assertThat(retrieved.email()).isEqualTo(dto.email());
}
```

**Why?** Implementation tests break when you refactor. Behavior tests break only when behavior changes.

---

## II. TEST STRUCTURE

### Arrange-Act-Assert (AAA)

```
@Test
void overdraftIsRejectedWhenInsufficientFunds() {
    // Arrange
    Account account = new Account(balance: 100);
    
    // Act
    Result result = account.withdraw(150);
    
    // Assert
    assertThat(result.isFailure()).isTrue();
    assertThat(result.error()).isEqualTo(INSUFFICIENT_FUNDS);
    assertThat(account.balance()).isEqualTo(100); // unchanged
}
```

### One Behavior Per Test

```
// ❌ Multiple behaviors
@Test
void testWithdrawal() {
    // tests success case
    // tests failure case
    // tests edge case
}

// ✅ Focused
@Test void withdrawalSucceedsWhenSufficientFunds() { ... }
@Test void withdrawalFailsWhenInsufficientFunds() { ... }
@Test void withdrawalOfExactBalanceSucceeds() { ... }
```

---

## III. TEST NAMING

### Format: `behaviorUnderCondition`

```
// ✅ Describes behavior
userIsLockedAfterThreeFailedLoginAttempts()
orderTotalIncludesTaxForTaxableItems()
expiredTokenIsRejected()
emptyCartCannotBeCheckedOut()

// ❌ Describes implementation
testValidate()
shouldCallService()
testMethod1()
```

---

## IV. WHAT TO TEST

### The Testing Pyramid

```
         /\
        /  \      E2E (few)
       /----\     - Critical user journeys only
      /      \    
     /--------\   Integration (some)
    /          \  - Component boundaries
   /------------\ - External systems
  /              \
 /----------------\ Unit (many)
                    - Business logic
                    - Pure functions
                    - Domain rules
```

### Unit Test Candidates

| Test | Don't Test |
|------|------------|
| Business rules | Getters/setters |
| Calculations | Framework code |
| State transitions | Private methods directly |
| Validation logic | External libraries |
| Edge cases | Trivial code |

### Integration Test Candidates

- Repository ↔ Database
- Service ↔ External API
- Message producer ↔ Broker

---

## V. TEST DOUBLES

### Prefer Real Objects

```
// ✅ Use real objects when practical
@Test
void discountIsAppliedCorrectly() {
    PricingEngine engine = new PricingEngine(); // real
    Order order = new Order(items, coupon);     // real
    
    Money total = engine.calculateTotal(order);
    
    assertThat(total).isEqualTo(Money.of(85));
}
```

### When to Use Doubles

| Use Case | Double Type |
|----------|-------------|
| Slow dependency (DB, network) | Fake or Mock |
| Non-deterministic (time, random) | Stub |
| Hard to trigger (errors, edge cases) | Stub |
| Verify interaction happened | Spy (sparingly) |

### Mock Boundaries, Not Internals

```
// ❌ Over-mocking (testing wiring, not behavior)
@Test
void processOrder() {
    when(validator.validate(any())).thenReturn(valid);
    when(pricer.price(any())).thenReturn(priced);
    when(repo.save(any())).thenReturn(saved);
    
    service.process(order);
    
    verify(validator).validate(order);
    verify(pricer).price(any());
    verify(repo).save(any());
}

// ✅ Mock at system boundary only
@Test
void processedOrderIsPersisted() {
    Order order = validOrder();
    
    service.process(order);
    
    assertThat(repository.findById(order.id())).isPresent();
}
```

---

## VI. TEST DATA

### Builder Pattern for Complex Objects

```
Order order = OrderBuilder.anOrder()
    .withItem("SKU-1", quantity: 2)
    .withCoupon("SAVE10")
    .withShipping(EXPRESS)
    .build();
```

### Descriptive Factory Methods

```
// ✅ Intent is clear
User activeUser = Users.active();
User suspendedUser = Users.suspended();
Order paidOrder = Orders.paid();
Order pendingOrder = Orders.pending();
```

### Avoid Magic Values

```
// ❌ What does 42 mean?
assertThat(result).isEqualTo(42);

// ✅ Self-documenting
int basePrice = 100;
int discountPercent = 10;
int expectedTotal = 90;
assertThat(calculator.apply(basePrice, discountPercent))
    .isEqualTo(expectedTotal);
```

---

## VII. EDGE CASES CHECKLIST

For every function, consider:

```
□ Null input
□ Empty collection / empty string
□ Single element
□ Boundary values (0, -1, MAX_INT)
□ Duplicates
□ Invalid format
□ Timeout / slow response
□ Concurrent access
```

---

## VIII. TEST QUALITY SIGNALS

### Good Tests Are:

| Property | Meaning |
|----------|---------|
| **Fast** | Milliseconds, not seconds |
| **Isolated** | No shared state, any order |
| **Repeatable** | Same result every run |
| **Self-validating** | Pass/fail, no manual check |
| **Timely** | Written before/with code |

### Test Smells

| Smell | Problem | Fix |
|-------|---------|-----|
| Flaky tests | Non-determinism | Control time, avoid sleep |
| Slow tests | Wrong pyramid level | Push down to unit |
| Commented tests | Dead code | Delete or fix |
| Test interdependence | Shared state | Isolate setup |
| Excessive mocking | Testing wiring | Use real objects |

---

## IX. WHEN TESTS BREAK

### After Refactoring (no behavior change)

- **Implementation tests break** → Delete/rewrite them (they were bad)
- **Behavior tests break** → You changed behavior, review if intentional

### After Feature Change

- Tests SHOULD break
- Update tests to reflect new expected behavior
- This is the safety net working correctly

---

## X. ASYNC TESTING

### Promises & Async/Await

```javascript
// ✅ Properly awaited
@Test
async function userCanBeCreatedAndRetrieved() {
    const id = await service.createUser(dto);
    const user = await service.getUser(id);

    assertThat(user.email).isEqualTo(dto.email);
}

// ❌ Forgotten await (flaky test)
@Test
async function test() {
    service.createUser(dto);  // ← missing await
    const user = await service.getUser(id);  // ← will fail
}
```

### Testing Timeouts

```javascript
// ✅ Test that timeout works
@Test
async function requestTimesOutAfter5Seconds() {
    const slowService = new SlowService(delay: 10000);

    await expect(
        slowService.fetch({ timeout: 5000 })
    ).rejects.toThrow(TimeoutError);
}
```

### Testing Concurrent Operations

```javascript
// ✅ Verify parallel execution
@Test
async function batchProcessingRunsConcurrently() {
    const start = Date.now();

    await Promise.all([
        processor.process(item1),  // takes 100ms
        processor.process(item2),  // takes 100ms
        processor.process(item3)   // takes 100ms
    ]);

    const duration = Date.now() - start;

    // Should be ~100ms (parallel), not 300ms (sequential)
    assertThat(duration).isLessThan(200);
}
```

### Common Async Pitfalls

| Pitfall | Problem | Fix |
|---------|---------|-----|
| Missing `await` | Test finishes before async code | Add `await` to all promises |
| Missing `async` keyword | Can't use `await` | Mark test function `async` |
| Uncaught rejections | Failing async code doesn't fail test | Use `await` or `.catch()` |
| Timeouts too short | Flaky tests on slow CI | Increase timeout or mock slow parts |

### Testing Event Emitters

```javascript
// ✅ Wait for event before asserting
@Test
async function emitsCompletionEvent() {
    const eventPromise = new Promise(resolve => {
        emitter.once('completed', resolve);
    });

    emitter.start();

    const event = await eventPromise;
    assertThat(event.status).isEqualTo('success');
}
```

---

*If your tests are hard to write, your code is hard to use.*
