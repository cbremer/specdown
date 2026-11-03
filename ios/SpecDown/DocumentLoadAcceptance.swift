/// Order native metadata commits by accepted renderer requests, not attempted
/// opens. A rejected newer document must not suppress an older accepted one.
struct DocumentLoadAcceptance {
    struct Request {
        fileprivate let generation: UInt64
        fileprivate let sequence: UInt64
    }

    private var generation: UInt64 = 0
    private var startedPage = false
    private var nextSequence: UInt64 = 0
    private var acceptedSequence: UInt64 = 0
    private var cancelled = Set<UInt64>()

    mutating func beginRequest() -> Request {
        nextSequence += 1
        return Request(generation: generation, sequence: nextSequence)
    }

    mutating func beginPageLoad() {
        if startedPage { invalidateRequests() }
        startedPage = true
    }

    mutating func invalidateRequests() {
        generation += 1
        cancelled.removeAll()
    }

    func canDeliver(_ request: Request) -> Bool {
        request.generation == generation && request.sequence > acceptedSequence && !cancelled.contains(request.sequence)
    }

    mutating func cancel(_ request: Request) {
        if request.generation == generation { cancelled.insert(request.sequence) }
    }

    mutating func accept(_ request: Request, rendererAccepted: Bool) -> Bool {
        guard rendererAccepted, canDeliver(request) else { return false }
        acceptedSequence = request.sequence
        return true
    }
}

/// Native acceptance can change the view without cancelling newer native
/// requests. Only a manual transition (which has no call-local delivery ID)
/// invalidates their generation. Acknowledgments supply the latest dispatch
/// token even when WebKit's message callback arrives later.
struct NativeDocumentViewTransitions {
    enum Transition: Equatable { case native, manual, welcome, alreadyAcknowledged }
    private var owned: [String: Bool] = [:]
    private(set) var token = ""
    mutating func beginDelivery(_ id: String) { owned[id] = false }
    mutating func rejectDelivery(_ id: String) { owned.removeValue(forKey: id) }
    mutating func acknowledge(_ id: String, token: String) {
        self.token = token
        if owned[id] != nil { owned[id] = true }
    }
    mutating func reset() { token = ""; owned.removeAll() }
    mutating func observe(token: String, deliveryID: String?, initialWelcome: Bool) -> Transition {
        if let id = deliveryID {
            guard let acknowledged = owned.removeValue(forKey: id) else { return .alreadyAcknowledged }
            // The acknowledgment already supplied this view and its source IDs.
            // A delayed message must not roll a newer native acknowledgment back.
            if acknowledged { return .alreadyAcknowledged }
            self.token = token
            return .native
        }
        if initialWelcome {
            if !self.token.isEmpty { return .alreadyAcknowledged }
            self.token = token
            return .welcome
        }
        owned.removeAll()
        self.token = token
        return .manual
    }
}
