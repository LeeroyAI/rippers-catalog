import Foundation

struct AIChatMessage: Encodable {
    let role: String
    let content: String
}

@MainActor
final class AIChatService {
    static let shared = AIChatService()
    private init() {}

    static let baseURL = "https://rippers-pied.vercel.app/api/chat"

    func send(messages: [AIChatMessage], context: String? = nil) async throws -> String {
        guard let url = URL(string: Self.baseURL) else { throw AIChatError.badURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        struct Body: Encodable {
            let messages: [AIChatMessage]
            let context: String?
        }
        request.httpBody = try JSONEncoder().encode(Body(messages: messages, context: context))

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw AIChatError.httpError
        }

        struct Reply: Decodable { let reply: String }
        return try JSONDecoder().decode(Reply.self, from: data).reply
    }
}

enum AIChatError: Error {
    case badURL, httpError
}
