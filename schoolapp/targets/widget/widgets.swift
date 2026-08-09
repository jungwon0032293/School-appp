import WidgetKit
import SwiftUI

// MARK: - 디자인 공통 스타일 정의

struct WidgetDesign {
    // 배경색 (다크모드/라이트모드 자동 대응)
    static let backgroundColor = Color(UIColor.systemBackground)
    
    // 급식 위젯 테마 색상 (차분하고 세련된 올리브 그린)
    static let mealAccent = Color(red: 0.38, green: 0.52, blue: 0.28)
    
    // 시간표 위젯 테마 색상 (부드러운 파스텔 인디고 블루)
    static let timetableAccent = Color(red: 0.28, green: 0.45, blue: 0.72)
    
    // 본문 글자 색상 (가독성 높은 은은한 흑색)
    static let bodyText = Color(UIColor.label).opacity(0.85)
    
    // 보조 안내 글자 색상
    static let subText = Color(UIColor.secondaryLabel)
}


// MARK: - 1. 급식 위젯 (MealWidget)

struct MealProvider: TimelineProvider {
    func placeholder(in context: Context) -> MealEntry {
        MealEntry(date: Date(), mealType: "오늘의 급식", mealList: "급식 정보 없음")
    }

    func getSnapshot(in context: Context, completion: @escaping (MealEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MealEntry>) -> ()) {
        let entry = loadEntry()
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60)))
        completion(timeline)
    }

    func loadEntry() -> MealEntry {
        let defaults = UserDefaults(suiteName: "group.com.ymk.schoolapp")
        let mealType = defaults?.string(forKey: "mealType") ?? "오늘의 급식"
        let mealList = defaults?.string(forKey: "mealList") ?? "급식 정보 없음"
        return MealEntry(date: Date(), mealType: mealType, mealList: mealList)
    }
}

struct MealEntry: TimelineEntry {
    let date: Date
    let mealType: String
    let mealList: String
}

struct MealWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: MealEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // 헤더 (아이콘 + 제목)
            HStack(spacing: 5) {
                Image(systemName: "fork.knife.circle.fill")
                    .foregroundColor(WidgetDesign.mealAccent)
                    .font(.system(size: family == .systemSmall ? 15 : 17))
                
                Text(entry.mealType)
                    .font(.system(size: family == .systemSmall ? 13 : 15, weight: .bold))
                    .foregroundColor(WidgetDesign.mealAccent)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.mealAccent.opacity(0.2))

            // 본문 (메뉴 리스트)
            if family == .systemSmall {
                let firstLine = entry.mealList.split(separator: "\n").first.map(String.init) ?? "급식 정보 없음"
                Text(firstLine)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(WidgetDesign.bodyText)
                    .lineLimit(3)
            } else {
                Text(entry.mealList)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(WidgetDesign.bodyText)
                    .lineSpacing(3)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .containerBackground(for: .widget) { WidgetDesign.backgroundColor }
    }
}

struct MealWidget: Widget {
    let kind: String = "MealWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MealProvider()) { entry in
            MealWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 급식")
        .description("오늘 학교 급식 메뉴를 바로 확인합니다.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}


// MARK: - 2. 시간표 위젯 (TimetableWidget)

struct TimetableProvider: TimelineProvider {
    func placeholder(in context: Context) -> TimetableEntry {
        TimetableEntry(date: Date(), timetableInfo: "오늘의 시간표 정보가 없습니다.")
    }

    func getSnapshot(in context: Context, completion: @escaping (TimetableEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TimetableEntry>) -> ()) {
        let entry = loadEntry()
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60)))
        completion(timeline)
    }

    func loadEntry() -> TimetableEntry {
        let defaults = UserDefaults(suiteName: "group.com.ymk.schoolapp")
        let timetableInfo = defaults?.string(forKey: "timetable") ?? "시간표 정보 없음"
        return TimetableEntry(date: Date(), timetableInfo: timetableInfo)
    }
}

struct TimetableEntry: TimelineEntry {
    let date: Date
    let timetableInfo: String
}

struct TimetableWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: TimetableEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // 헤더 (아이콘 + 제목)
            HStack(spacing: 5) {
                Image(systemName: "calendar.badge.clock")
                    .foregroundColor(WidgetDesign.timetableAccent)
                    .font(.system(size: family == .systemSmall ? 15 : 17))
                
                Text("오늘의 시간표")
                    .font(.system(size: family == .systemSmall ? 13 : 15, weight: .bold))
                    .foregroundColor(WidgetDesign.timetableAccent)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.timetableAccent.opacity(0.2))

            // 본문 (시간표 정보)
            Text(entry.timetableInfo)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(WidgetDesign.bodyText)
                .lineSpacing(family == .systemSmall ? 2 : 4)

            Spacer(minLength: 0)
        }
        .padding(14)
        .containerBackground(for: .widget) { WidgetDesign.backgroundColor }
    }
}

struct TimetableWidget: Widget {
    let kind: String = "TimetableWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TimetableProvider()) { entry in
            TimetableWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("오늘의 시간표")
        .description("오늘의 수업 시간표를 바로 확인합니다.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
