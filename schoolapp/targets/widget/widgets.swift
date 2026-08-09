import WidgetKit
import SwiftUI

// MARK: - 디자인 공통 스타일

struct WidgetDesign {
    static let backgroundColor = Color(UIColor.systemBackground)
    static let mealAccent = Color(red: 0.38, green: 0.52, blue: 0.28)
    static let timetableAccent = Color(red: 0.28, green: 0.45, blue: 0.72)
    static let bodyText = Color(UIColor.label).opacity(0.88)
    static let subText = Color(UIColor.secondaryLabel)
}


// MARK: - 1. 급식 위젯 (MealWidget)

struct MealProvider: TimelineProvider {
    func placeholder(in context: Context) -> MealEntry {
        MealEntry(date: Date(), mealType: "오늘의 급식", mealList: "맛있는 급식 메뉴가 표시됩니다.")
    }

    func getSnapshot(in context: Context, completion: @escaping (MealEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MealEntry>) -> ()) {
        let entry = loadEntry()
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 30)))
        completion(timeline)
    }

    func loadEntry() -> MealEntry {
        let defaults = UserDefaults(suiteName: "group.com.ymk.schoolapp")
        let mealType = defaults?.string(forKey: "mealType") ?? "오늘의 급식"
        let rawMealList = defaults?.string(forKey: "mealList") ?? "급식 정보가 없습니다."
        
        return MealEntry(date: Date(), mealType: mealType, mealList: rawMealList)
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
        VStack(alignment: .leading, spacing: 4) {
            // 헤더
            HStack(spacing: 4) {
                Image(systemName: "fork.knife.circle.fill")
                    .foregroundColor(WidgetDesign.mealAccent)
                    .font(.system(size: family == .systemSmall ? 13 : 15))
                
                Text(entry.mealType)
                    .font(.system(size: family == .systemSmall ? 12 : 14, weight: .bold))
                    .foregroundColor(WidgetDesign.mealAccent)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.mealAccent.opacity(0.2))

            // 본문 영역 (급식 메뉴)
            if family == .systemSmall {
                // 소형 위젯: 줄바꿈을 쉼표로 연결하여 2~3개 이상의 메뉴가 잘 보이도록 처리
                let formattedMenu = entry.mealList
                    .components(separatedBy: "\n")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
                    .joined(separator: ", ")
                
                Text(formattedMenu.isEmpty ? "급식 정보 없음" : formattedMenu)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(WidgetDesign.bodyText)
                    .lineSpacing(2)
                    .lineLimit(4) // 최대 4줄까지 채워서 표시
            } else {
                // 중형 위젯: 폰트를 조절하여 전체 메뉴가 잘리지 않고 많이 보이도록 처리
                Text(entry.mealList)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(WidgetDesign.bodyText)
                    .lineSpacing(2)
                    .minimumScaleFactor(0.85) // 글자가 많을 때 약간 축소하여 다 보여줌
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .widgetURL(URL(string: "schoolapp://meal")) // 🔗 바로가기 링크 (급식 탭)
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
        TimetableEntry(date: Date(), timetableInfo: "1교시: 국어\n2교시: 수학\n3교시: 영어")
    }

    func getSnapshot(in context: Context, completion: @escaping (TimetableEntry) -> ()) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TimetableEntry>) -> ()) {
        let entry = loadEntry()
        let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 30)))
        completion(timeline)
    }

    func loadEntry() -> TimetableEntry {
        let defaults = UserDefaults(suiteName: "group.com.ymk.schoolapp")
        
        // 시간표 연동 호환성 강화 (다양한 키 이름 및 구조 자동 탐색)
        var timetableString = defaults?.string(forKey: "timetable")
        
        if timetableString == nil || timetableString?.isEmpty == true {
            timetableString = defaults?.string(forKey: "timetableList") ?? defaults?.string(forKey: "timeTable")
        }
        
        // 만약 배열(Array) 형태로 저장되어 들어올 경우 텍스트로 변환
        if timetableString == nil, let arrayData = defaults?.array(forKey: "timetable") as? [String] {
            timetableString = arrayData.joined(separator: "\n")
        }

        let result = timetableString?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "시간표 정보가 없습니다."
        return TimetableEntry(date: Date(), timetableInfo: result)
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
        VStack(alignment: .leading, spacing: 4) {
            // 헤더
            HStack(spacing: 4) {
                Image(systemName: "calendar.badge.clock")
                    .foregroundColor(WidgetDesign.timetableAccent)
                    .font(.system(size: family == .systemSmall ? 13 : 15))
                
                Text("오늘의 시간표")
                    .font(.system(size: family == .systemSmall ? 12 : 14, weight: .bold))
                    .foregroundColor(WidgetDesign.timetableAccent)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.timetableAccent.opacity(0.2))

            // 본문 (시간표)
            Text(entry.timetableInfo)
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundColor(WidgetDesign.bodyText)
                .lineSpacing(2)
                .minimumScaleFactor(0.85)

            Spacer(minLength: 0)
        }
        .padding(10)
        .widgetURL(URL(string: "schoolapp://timetable")) // 🔗 바로가기 링크 (시간표 탭)
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
