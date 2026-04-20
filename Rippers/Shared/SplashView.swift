import SwiftUI

struct SplashView: View {
    let onGetStarted: () -> Void

    @State private var logoScale: CGFloat = 0.5
    @State private var logoOpacity: Double = 0
    @State private var titleOpacity: Double = 0
    @State private var titleOffset: CGFloat = 24
    @State private var contentOpacity: Double = 0
    @State private var contentOffset: CGFloat = 32
    @State private var buttonOpacity: Double = 0

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.rOrange, Color.rOrangeDark],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()
                VStack(spacing: 22) {
                    RippersLogoMark()
                        .frame(width: 140, height: 140)
                        .scaleEffect(logoScale)
                        .opacity(logoOpacity)

                    VStack(spacing: 8) {
                        Text("Rippers")
                            .font(.system(size: 58, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)

                        Text("Ride what fits.\nFind what lasts.")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.96))
                            .multilineTextAlignment(.center)
                    }
                    .opacity(titleOpacity)
                    .offset(y: titleOffset)

                    VStack(alignment: .leading, spacing: 10) {
                        splashBullet("Matched picks from real AU retailers")
                        splashBullet("Sizing, budget & trip planning tools")
                        splashBullet("Live search powered by AI")
                    }
                    .padding(16)
                    .background(Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.white.opacity(0.22), lineWidth: 1))
                    .padding(.horizontal, 18)
                    .opacity(contentOpacity)
                    .offset(y: contentOffset)
                }
                Spacer()
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button("Get Started") {
                onGetStarted()
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.white)
            .foregroundStyle(Color.rOrangeDark)
            .font(.headline.weight(.bold))
            .controlSize(.large)
            .shadow(color: Color.white.opacity(0.3), radius: 14, x: 0, y: 0)
            .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
            .padding(.bottom, 8)
            .opacity(buttonOpacity)
        }
        .onAppear {
            withAnimation(.spring(response: 0.65, dampingFraction: 0.68).delay(0.1)) {
                logoScale = 1.0
                logoOpacity = 1.0
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.45)) {
                titleOpacity = 1.0
                titleOffset = 0
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.7)) {
                contentOpacity = 1.0
                contentOffset = 0
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.9)) {
                buttonOpacity = 1.0
            }
        }
    }

    private func splashBullet(_ text: String) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .font(.body.weight(.bold))
                .foregroundStyle(.white.opacity(0.95))
            Text(text)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white.opacity(0.95))
        }
    }
}

struct RippersLogoMark: View {
    var onDark: Bool = true

    var body: some View {
        ZStack {
            Circle()
                .fill(onDark ? Color.white.opacity(0.18) : Color.rOrange)
                .overlay(
                    Circle().stroke(onDark ? Color.white.opacity(0.35) : Color.clear, lineWidth: 1)
                )
            Image("rippers-logo-mark")
                .resizable()
                .scaledToFit()
                .padding(8)
        }
    }
}
