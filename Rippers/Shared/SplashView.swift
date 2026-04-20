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
        Canvas { context, size in
            let w = size.width
            let h = size.height
            let s = min(w, h)
            let sc = s * 0.096  // rider scale

            context.clip(to: Path(ellipseIn: CGRect(origin: .zero, size: size)))

            // Background
            context.fill(
                Path(ellipseIn: CGRect(origin: .zero, size: size)),
                with: .color(onDark ? Color.white.opacity(0.18) : Color.rOrange)
            )

            // Mountain range — aggressive peak with near-vertical cliff (the "drop")
            var mountain = Path()
            mountain.move(to: CGPoint(x: 0, y: h))
            mountain.addLine(to: CGPoint(x: 0, y: h * 0.78))
            mountain.addLine(to: CGPoint(x: w * 0.16, y: h * 0.56))
            mountain.addLine(to: CGPoint(x: w * 0.29, y: h * 0.66))
            mountain.addLine(to: CGPoint(x: w * 0.40, y: h * 0.34))   // main peak — launch point
            mountain.addLine(to: CGPoint(x: w * 0.60, y: h * 0.73))   // cliff base
            mountain.addLine(to: CGPoint(x: w * 0.72, y: h * 0.59))
            mountain.addLine(to: CGPoint(x: w * 0.86, y: h * 0.76))
            mountain.addLine(to: CGPoint(x: w, y: h * 0.66))
            mountain.addLine(to: CGPoint(x: w, y: h))
            mountain.closeSubpath()
            context.fill(mountain, with: .color(.white))

            // Shadow on cliff face — sells the steepness
            var cliffShadow = Path()
            cliffShadow.move(to: CGPoint(x: w * 0.40, y: h * 0.34))
            cliffShadow.addLine(to: CGPoint(x: w * 0.60, y: h * 0.73))
            cliffShadow.addLine(to: CGPoint(x: w * 0.40, y: h * 0.73))
            cliffShadow.closeSubpath()
            context.fill(cliffShadow, with: .color(Color.black.opacity(0.20)))

            // Rider mid-air, upper-right — just cleared the peak
            let rx = w * 0.70
            let ry = h * 0.30
            let wheelR = sc * 1.02

            let rearC = CGPoint(x: rx - sc * 1.38, y: ry + sc * 1.08)
            let frontC = CGPoint(x: rx + sc * 1.48, y: ry + sc * 0.72)

            // Wheels — filled circles for bold readability at any size
            for wc in [rearC, frontC] {
                var wPath = Path()
                wPath.addEllipse(in: CGRect(
                    x: wc.x - wheelR, y: wc.y - wheelR,
                    width: wheelR * 2, height: wheelR * 2))
                context.fill(wPath, with: .color(.white))
            }

            // Knobby tread bumps (visible at larger sizes)
            if s >= 68 {
                for wc in [rearC, frontC] {
                    for i in 0..<8 {
                        let angle = Double(i) * .pi / 4.0
                        let bx = wc.x + (wheelR + sc * 0.22) * cos(angle)
                        let by = wc.y + (wheelR + sc * 0.22) * sin(angle)
                        let br = sc * 0.16
                        var bump = Path()
                        bump.addEllipse(in: CGRect(x: bx - br, y: by - br, width: br * 2, height: br * 2))
                        context.fill(bump, with: .color(.white))
                    }
                }
            }

            // Bike frame — simplified diamond triangle
            let bb   = CGPoint(x: rx + 0.06 * sc, y: ry + 0.84 * sc)
            let seat = CGPoint(x: rx - 0.94 * sc, y: ry - 0.72 * sc)
            let head = CGPoint(x: rx + 1.34 * sc, y: ry - 0.42 * sc)

            var frame = Path()
            frame.move(to: bb);   frame.addLine(to: seat)
            frame.addLine(to: head); frame.addLine(to: bb)
            frame.move(to: seat); frame.addLine(to: rearC)
            frame.move(to: bb);   frame.addLine(to: rearC)
            frame.move(to: head); frame.addLine(to: frontC)
            context.stroke(frame, with: .color(.white), lineWidth: sc * 0.40)

            // Rider torso — forward attack lean
            let hip      = CGPoint(x: rx - 0.46 * sc, y: ry - 0.42 * sc)
            let shoulder = CGPoint(x: rx + 0.50 * sc, y: ry - 1.80 * sc)
            var torso = Path()
            torso.move(to: hip); torso.addLine(to: shoulder)
            context.stroke(torso, with: .color(.white), lineWidth: sc * 0.54)

            // Head / helmet
            let headR = sc * 0.54
            let headC = CGPoint(x: shoulder.x + 0.18 * sc, y: shoulder.y - headR - 0.06 * sc)
            var headPath = Path()
            headPath.addEllipse(in: CGRect(
                x: headC.x - headR, y: headC.y - headR,
                width: headR * 2, height: headR * 2))
            context.fill(headPath, with: .color(.white))

            // Arm reaching forward to bars
            var arm = Path()
            arm.move(to: shoulder)
            arm.addLine(to: CGPoint(x: rx + 1.34 * sc, y: ry - 1.00 * sc))
            context.stroke(arm, with: .color(.white), lineWidth: sc * 0.44)

            // Speed lines — trail of air beneath the bike
            for i in 0..<3 {
                let d = Double(i)
                let ly = ry + sc * (2.40 + d * 0.55)
                let lx = rx - sc * (1.60 - d * 0.28)
                var line = Path()
                line.move(to: CGPoint(x: lx, y: ly))
                line.addLine(to: CGPoint(x: lx - sc * (1.10 - d * 0.25), y: ly + sc * 0.18))
                context.stroke(line, with: .color(Color.white.opacity(0.42 - d * 0.11)),
                               lineWidth: sc * 0.28)
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .overlay(
            Circle().stroke(onDark ? Color.white.opacity(0.35) : Color.clear, lineWidth: 1)
        )
    }
}
