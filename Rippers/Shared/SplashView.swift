import SwiftUI

struct SplashView: View {
    let onGetStarted: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.rOrange, Color.rOrangeDark],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 12)
                VStack(spacing: 18) {
                    RippersLogoMark()
                        .frame(width: 128, height: 128)

                    Text("Rippers")
                        .font(.system(size: 52, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Find the right mountain bike with confidence.")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.96))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)

                    VStack(alignment: .leading, spacing: 8) {
                        splashBullet("Create a rider profile for fit, style, and budget preferences.")
                        splashBullet("Search live catalog results and compare bikes side-by-side.")
                        splashBullet("Use sizing, budget, and trip tools to plan before you buy.")
                    }
                    .padding(14)
                    .background(Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.white.opacity(0.22), lineWidth: 1)
                    )
                    .padding(.horizontal, 18)
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
            .shadow(color: Color.white.opacity(0.25), radius: 12, x: 0, y: 0)
            .shadow(color: Color.black.opacity(0.2), radius: 8, x: 0, y: 4)
            .padding(.bottom, 8)
        }
    }

    private func splashBullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(.white.opacity(0.95))
                .padding(.top, 2)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.95))
        }
    }
}

struct RippersLogoMark: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.white.opacity(0.16))
                .overlay(
                    Circle().stroke(Color.white.opacity(0.35), lineWidth: 2)
                )

            VStack(spacing: 6) {
                // Mountains
                ZStack(alignment: .bottom) {
                    Triangle()
                        .fill(Color.white.opacity(0.35))
                        .frame(width: 64, height: 40)
                        .offset(x: -18)
                    Triangle()
                        .fill(Color.white.opacity(0.55))
                        .frame(width: 72, height: 46)
                        .offset(x: 16)
                }
                .frame(height: 44)

                // Rider + bike mark
                ZStack {
                    Image(systemName: "figure.outdoor.cycle")
                        .font(.system(size: 38, weight: .bold))
                        .foregroundStyle(Color.white)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.white.opacity(0.8))
                        .frame(width: 58, height: 3)
                        .rotationEffect(.degrees(-15))
                        .offset(y: 24)
                }

                Text("MTB")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.white.opacity(0.95))
                    .tracking(0.6)
            }
        }
    }
}

struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
