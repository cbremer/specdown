import Foundation

@main
struct RecentDocumentsTests {
    static func main() throws {
        let suite = "SpecDown.Tests.\(UUID())"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = RecentDocuments(defaults: defaults)
        let first = RecentDocuments.Entry(id: "one", name: "README.md", location: "Provider A/project", bookmark: Data([1]))
        let second = RecentDocuments.Entry(id: "two", name: "README.md", location: "Provider B/project", bookmark: Data([2]))
        precondition(store.entries.isEmpty)
        store.record(first)
        store.record(second)
        precondition(store.entries.map(\.id) == ["two", "one"], "Same names merged")
        let restart = RecentDocuments(defaults: defaults)
        precondition(restart.entries == [second, first], "Recents did not survive restart")
        restart.record(first)
        precondition(restart.entries.map(\.id) == ["one", "two"])
        for i in 0..<30 {
            restart.record(.init(id: "id\(i)", name: "\(i).md", location: "synthetic", bookmark: Data([3])))
        }
        precondition(restart.entries.count == 20)
        let beforeOversized = restart.entries
        restart.record(.init(id: "oversized", name: String(repeating: "x", count: 5000), location: "synthetic", bookmark: Data([3])))
        precondition(restart.entries == beforeOversized, "Unbounded recent metadata accepted")
        let raw = Data("{\"version\":999,\"entries\":[]}".utf8)
        defaults.set(raw, forKey: RecentDocuments.key)
        let future = RecentDocuments(defaults: defaults)
        future.record(first)
        precondition(defaults.data(forKey: RecentDocuments.key) == raw, "Overwrote unknown store")
        var gate = DocumentLoadAcceptance()
        let a = gate.beginRequest()
        let b = gate.beginRequest()
        precondition(gate.accept(b, rendererAccepted: true))
        precondition(!gate.canDeliver(a), "Old provider read can replace accepted document")
        gate.invalidateRequests()
        precondition(!gate.canDeliver(b))
        var coldStart = DocumentLoadAcceptance()
        let coldOpen = coldStart.beginRequest()
        coldStart.beginPageLoad()
        precondition(coldStart.canDeliver(coldOpen), "Initial viewer setup discarded a cold-start file")
        coldStart.beginPageLoad()
        precondition(!coldStart.canDeliver(coldOpen), "Reload retained an old-page acknowledgment")
        var cancelledGate = DocumentLoadAcceptance()
        let cancelledRequest = cancelledGate.beginRequest()
        cancelledGate.cancel(cancelledRequest)
        precondition(!cancelledGate.canDeliver(cancelledRequest))
        precondition(!cancelledGate.accept(cancelledRequest, rendererAccepted: true), "Timed-out provider committed")
        var ordered = DocumentLoadAcceptance()
        let slowA = ordered.beginRequest()
        let fastB = ordered.beginRequest()
        let delivery = DocumentDeliveryQueue()
        var finishB: (() -> Void)?
        var visible = "initial"
        delivery.submit { done in
            visible = "B"
            finishB = { _ = ordered.accept(fastB, rendererAccepted: true); done() }
        }
        delivery.submit { done in
            if ordered.canDeliver(slowA) { visible = "A" }
            done()
        }
        precondition(visible == "B")
        finishB?()
        precondition(visible == "B", "Older provider response replaced B before/after acknowledgment")
        // Both reads begin in V. Acceptance of older A is an owned native
        // transition, so newer B stays eligible and dispatches against A.
        var orderedViews = NativeDocumentViewTransitions()
        var orderedGate = DocumentLoadAcceptance()
        precondition(orderedViews.observe(token: "V", deliveryID: nil, initialWelcome: true) == .welcome)
        let nativeA = orderedGate.beginRequest()
        let nativeB = orderedGate.beginRequest()
        orderedViews.beginDelivery("delivery-a")
        precondition(orderedViews.observe(token: "A", deliveryID: "delivery-a", initialWelcome: false) == .native)
        precondition(orderedGate.accept(nativeA, rendererAccepted: true))
        orderedViews.acknowledge("delivery-a", token: "A")
        precondition(orderedGate.canDeliver(nativeB), "A acceptance suppressed newer B")
        precondition(orderedViews.token == "A", "B retained the original dispatch token V")
        orderedViews.beginDelivery("delivery-b")
        precondition(orderedGate.accept(nativeB, rendererAccepted: true))
        orderedViews.acknowledge("delivery-b", token: "B")
        precondition(orderedViews.observe(token: "B", deliveryID: "delivery-b", initialWelcome: false) == .alreadyAcknowledged)
        precondition(orderedViews.token == "B")
        let pendingManual = orderedGate.beginRequest()
        precondition(orderedViews.observe(token: "manual-a", deliveryID: nil, initialWelcome: false) == .manual)
        orderedGate.invalidateRequests()
        precondition(orderedViews.observe(token: "manual-b", deliveryID: nil, initialWelcome: false) == .manual)
        precondition(orderedViews.observe(token: "manual-a-again", deliveryID: nil, initialWelcome: false) == .manual)
        precondition(!orderedGate.canDeliver(pendingManual), "Manual A-B-A restored an old request")
        // An old native message arriving after a later acknowledgment is inert.
        var delayedViews = NativeDocumentViewTransitions()
        delayedViews.beginDelivery("old")
        delayedViews.acknowledge("old", token: "old-token")
        delayedViews.beginDelivery("new")
        delayedViews.acknowledge("new", token: "new-token")
        precondition(delayedViews.observe(token: "old-token", deliveryID: "old", initialWelcome: false) == .alreadyAcknowledged)
        precondition(delayedViews.token == "new-token")
        // An old delivery cannot become manual navigation after its ownership
        // was cleared by a genuine manual view replacement or page reset.
        var obsolete = NativeDocumentViewTransitions()
        obsolete.beginDelivery("obsolete")
        obsolete.acknowledge("obsolete", token: "old-native")
        precondition(obsolete.observe(token: "manual-C", deliveryID: nil, initialWelcome: false) == .manual)
        var afterManual = DocumentLoadAcceptance()
        let currentRequest = afterManual.beginRequest()
        precondition(obsolete.observe(token: "old-native", deliveryID: "obsolete", initialWelcome: false) == .alreadyAcknowledged)
        precondition(obsolete.token == "manual-C")
        precondition(afterManual.canDeliver(currentRequest))
        precondition(obsolete.observe(token: "unknown-view", deliveryID: "never-owned", initialWelcome: false) == .alreadyAcknowledged)
        precondition(obsolete.token == "manual-C")
        obsolete.reset()
        precondition(obsolete.observe(token: "old-native", deliveryID: "obsolete", initialWelcome: false) == .alreadyAcknowledged)
        precondition(obsolete.token.isEmpty)
        print("Recent documents: persistence, same names, bounds, future preservation and stale requests passed")
    }
}
