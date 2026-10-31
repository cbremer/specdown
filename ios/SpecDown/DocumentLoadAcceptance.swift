/// Order native metadata commits by accepted renderer requests, not attempted
/// opens. A rejected newer document must not suppress an older accepted one.
struct DocumentLoadAcceptance {
    struct Request {
        fileprivate let generation: UInt64
        fileprivate let sequence: UInt64
    }

    private var generation: UInt64 = 0
    private var nextSequence: UInt64 = 0
    private var acceptedSequence: UInt64 = 0

    mutating func beginRequest() -> Request {
        nextSequence += 1
        return Request(generation: generation, sequence: nextSequence)
    }

    mutating func invalidateRequests() {
        generation += 1
    }

    mutating func accept(_ request: Request, rendererAccepted: Bool) -> Bool {
        guard rendererAccepted, request.generation == generation,
              request.sequence > acceptedSequence else { return false }
        acceptedSequence = request.sequence
        return true
    }
}
