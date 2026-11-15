import SwiftUI

// MARK: - The Agents Pocket mark

/// The app's mark drawn in code: three cards fanned out of a pocket. Ported
/// from the approved Live Activity mockup's inline SVG (viewBox 162 200 700
/// 700): each card is a 270 x 520 rounded rect (radius 64) rotated about
/// (512, 790), and every shape in front cuts a gap into the ones behind it.
/// The gap is a 52-unit stroke at normal sizes and a 120-unit one at 22 pt
/// and under, where the thin gaps would close up.
struct AgentsPocketMarkLayer: Shape {
    enum Layer: CaseIterable, Sendable {
        case back, middle, front, pocket

        /// The mockup's fill opacity for each layer of the one-color mark.
        var opacity: Double {
            switch self {
            case .back: 0.5
            case .middle: 0.75
            case .front: 1
            case .pocket: 0.72
            }
        }
    }

    enum Gap: Sendable {
        case regular, small

        /// The gap stroke's width in viewBox units (half of it eats into each side).
        var strokeWidth: CGFloat {
            switch self {
            case .regular: 52
            case .small: 120
            }
        }

        /// The mockup switches to the wide-gap drawing at this size and under.
        static func forSize(_ size: CGFloat) -> Gap {
            size <= 22 ? .small : .regular
        }
    }

    let layer: Layer
    let gap: Gap

    func path(in rect: CGRect) -> Path {
        AgentsPocketMarkGeometry.path(layer, gap: gap)
            .applying(AgentsPocketMarkGeometry.fit(into: rect))
    }
}

enum AgentsPocketMarkGeometry {
    static let viewBox = CGRect(x: 162, y: 200, width: 700, height: 700)
    private static let pivot = CGPoint(x: 512, y: 790)

    /// A card rotated about the pocket's center; SVG and Core Graphics both
    /// turn positive angles clockwise in a y-down space.
    static func card(degrees: CGFloat) -> Path {
        let card = Path(
            roundedRect: CGRect(x: 377, y: 270, width: 270, height: 520), cornerRadius: 64,
            style: .circular)
        let turn = CGAffineTransform(translationX: pivot.x, y: pivot.y)
            .rotated(by: degrees * .pi / 180)
            .translatedBy(x: -pivot.x, y: -pivot.y)
        return card.applying(turn)
    }

    /// `M222 690 Q222 650 262 650 H762 Q802 650 802 690 V725 A95 95 0 0 1 707 820
    /// H317 A95 95 0 0 1 222 725 Z`: a tray with a flat top and round bottom corners.
    static var pocket: Path {
        var path = Path()
        path.move(to: CGPoint(x: 222, y: 690))
        path.addQuadCurve(to: CGPoint(x: 262, y: 650), control: CGPoint(x: 222, y: 650))
        path.addLine(to: CGPoint(x: 762, y: 650))
        path.addQuadCurve(to: CGPoint(x: 802, y: 690), control: CGPoint(x: 802, y: 650))
        path.addLine(to: CGPoint(x: 802, y: 725))
        path.addArc(
            tangent1End: CGPoint(x: 802, y: 820), tangent2End: CGPoint(x: 707, y: 820), radius: 95)
        path.addLine(to: CGPoint(x: 317, y: 820))
        path.addArc(
            tangent1End: CGPoint(x: 222, y: 820), tangent2End: CGPoint(x: 222, y: 725), radius: 95)
        path.closeSubpath()
        return path
    }

    /// The shape grown by half the gap stroke: what the SVG mask paints black.
    private static func grown(_ path: Path, gap: AgentsPocketMarkLayer.Gap) -> Path {
        path.union(path.strokedPath(StrokeStyle(lineWidth: gap.strokeWidth, lineJoin: .round)))
    }

    static func path(_ layer: AgentsPocketMarkLayer.Layer, gap: AgentsPocketMarkLayer.Gap) -> Path {
        let back = card(degrees: -26)
        let middle = card(degrees: 26)
        let front = card(degrees: 0)
        switch layer {
        case .back:
            return back.subtracting(
                grown(middle, gap: gap).union(grown(front, gap: gap)).union(grown(pocket, gap: gap)))
        case .middle:
            return middle.subtracting(grown(front, gap: gap).union(grown(pocket, gap: gap)))
        case .front:
            return front.subtracting(grown(pocket, gap: gap))
        case .pocket:
            return pocket
        }
    }

    /// Scales the square viewBox into `rect`, centered, keeping its aspect.
    static func fit(into rect: CGRect) -> CGAffineTransform {
        let scale = min(rect.width, rect.height) / viewBox.width
        return CGAffineTransform(
            a: scale, b: 0, c: 0, d: scale,
            tx: rect.minX + (rect.width - viewBox.width * scale) / 2 - viewBox.minX * scale,
            ty: rect.minY + (rect.height - viewBox.height * scale) / 2 - viewBox.minY * scale)
    }
}

/// The mark in one color, alone, without a container (HIG: no app icon tile
/// inside a Live Activity).
struct AgentsPocketMark: View {
    let size: CGFloat
    var color: Color = AgentActivityChrome.mark

    var body: some View {
        let gap = AgentsPocketMarkLayer.Gap.forSize(size)
        ZStack {
            ForEach(AgentsPocketMarkLayer.Layer.allCases, id: \.self) { @Sendable layer in
                AgentsPocketMarkLayer(layer: layer, gap: gap).fill(color.opacity(layer.opacity))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The mockup's "Esquina" placement: the mark small and quiet in a corner,
/// at 60% white, next to whatever the trailing edge already shows.
struct AgentActivityCornerMark: View {
    var body: some View {
        AgentsPocketMark(size: AgentActivityMetrics.cornerMark, color: AgentActivityChrome.mark)
    }
}

/// The mockup's "Es el estado" placement: the mark tinted by a status, with
/// the status glyph as a corner badge so the state reads without color
/// (exclamation mark, check mark, open ring, dashed ring).
struct AgentActivityStateMark: View {
    let status: String
    let size: CGFloat

    var body: some View {
        let badge = max(9, (size * 0.48).rounded())
        AgentsPocketMark(size: size, color: AgentActivityStatusStyle.ink(for: status))
            .overlay(alignment: .bottomTrailing) {
                AgentActivityStatusGlyph(status: status, size: badge)
                    .background(Circle().fill(Color.black).padding(-1.5))
                    .offset(x: (badge * 0.3).rounded(), y: (badge * 0.15).rounded())
            }
            .accessibilityHidden(true)
    }
}
