import Foundation

/// Serialize renderer acceptance, not just JavaScript dispatch. A slow earlier
/// provider result is checked again after the newer renderer acknowledgment.
final class DocumentDeliveryQueue {
    typealias Delivery = (@escaping () -> Void) -> Void
    private var waiting: [Delivery] = []
    private var running = false
    @discardableResult
    func submit(_ delivery: @escaping Delivery) -> Bool {
        guard waiting.count < 2 else { return false }
        if running { waiting.append(delivery) }
        else { running = true; run(delivery) }
        return true
    }
    private func run(_ delivery: Delivery) {
        delivery { [weak self] in
            guard let self else { return }
            if self.waiting.isEmpty { self.running = false }
            else { self.run(self.waiting.removeFirst()) }
        }
    }
}

/// The only cross-thread provider-read state; native provider objects stay local
/// to their worker thread. Cancellation suppresses post-timeout reads/results.
final class DocumentReadPermit: @unchecked Sendable {
    private let lock = NSLock()
    private var cancelled = false
    func cancel() { lock.lock(); cancelled = true; lock.unlock() }
    var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
}
