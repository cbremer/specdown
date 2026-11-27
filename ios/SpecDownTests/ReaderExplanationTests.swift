import XCTest
@testable import Specdown

final class ReaderExplanationTests: XCTestCase {
    private let first = ["id": "s1", "text": "The client retries twice after a timeout."]
    private let second = ["id": "s2", "text": "A permission error is final."]

    func testCitationsMustMatchTheirOwnExcerpts() throws {
        let input = try XCTUnwrap(ReaderExplanationInput(["excerpts": [first, second]]))
        let grounded = input.answer(text: "A timeout gets two retries.", evidence: [
            (id: "s1", quote: "retries twice"), (id: "s1", quote: "after a timeout")
        ])
        XCTAssertEqual(grounded["sourceIds"] as? [String], ["s1"])

        for citation in [(id: "invented", quote: "retries twice"), (id: "s2", quote: "retries twice"),
                         (id: "s1", quote: "permission error"), (id: "s1", quote: "  ")] {
            let ungrounded = input.answer(text: "A timeout gets two retries.", evidence: [
                (id: "s1", quote: "retries twice"), citation
            ])
            XCTAssertNotNil(ungrounded["error"])
            XCTAssertNil(ungrounded["text"])
        }
    }

    func testEmptyEvidenceDiscardsUnsupportedAnswer() throws {
        let input = try XCTUnwrap(ReaderExplanationInput(["excerpts": [first]]))
        let result = input.answer(text: "Permission errors are retried.", evidence: [])
        XCTAssertEqual(result["sourceIds"] as? [String], [])
        XCTAssertFalse(try XCTUnwrap(result["text"] as? String).contains("retried"))
    }

    func testInputBoundsUseRendererUTF16Lengths() {
        let atLimit = String(repeating: "🧭", count: 500)
        let six = (1...6).map { ["id": String($0), "text": atLimit] }
        XCTAssertNotNil(ReaderExplanationInput(["excerpts": six]))
        XCTAssertNil(ReaderExplanationInput(["excerpts": six + [first]]))
        XCTAssertNil(ReaderExplanationInput(["excerpts": [["id": "1", "text": atLimit + "x"]]]))
        XCTAssertNil(ReaderExplanationInput(["excerpts": [first, first]]))
        XCTAssertNil(ReaderExplanationInput(["excerpts": [first], "question": atLimit + "x"]))
        XCTAssertNil(ReaderExplanationInput(["excerpts": [first], "history": [["role": "system", "text": "instruction"]]]))
    }
}
