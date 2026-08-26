import WidgetKit
import SwiftUI

// MARK: - 디자인 공통 스타일

struct WidgetDesign {
    static let backgroundColor = Color(UIColor.systemBackground)
    static let mealAccent = Color(red: 0.33, green: 0.42, blue: 0.18) // #556B2F
    static let dinnerAccent = Color.orange
    static let timetableAccent = Color(red: 0.33, green: 0.42, blue: 0.18) // #556B2F
    static let bodyText = Color(UIColor.label).opacity(0.88)
    static let subText = Color(UIColor.secondaryLabel)
}


// MARK: - 1. 급식 위젯 (MealWidget)

struct MealProvider: TimelineProvider {
    func placeholder(in context: Context) -> MealEntry {
        MealEntry(
            date: Date(),
            mealType: "오늘의 급식",
            lunch: "강황쌀밥, 얼큰짬뽕국, 두부양념조림, 모듬버섯들깨볶음, 닭봉튀김, 배추김치, 액설런트아이스크림",
            dinner: "찹쌀밥, 시래기된장국, 깻잎쌈, 매콤쭈삼볶음, 가지구이/양념간장, 설빙인절미토스트, 배추김치, 심쿵오렌지망고에이드"
        )
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
        let lunch = defaults?.string(forKey: "mealLunch") ?? "급식 정보가 없습니다."
        let dinner = defaults?.string(forKey: "mealDinner") ?? "저녁 급식 정보가 없습니다."
        
        return MealEntry(date: Date(), mealType: mealType, lunch: lunch, dinner: dinner)
    }
}

struct MealEntry: TimelineEntry {
    let date: Date
    let mealType: String
    let lunch: String
    let dinner: String
}

struct MealWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: MealEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // 헤더 영역
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

            // 본문 영역 (작은 위젯: 중식 전체 / 큰 위젯: 중식 + 석식 전체)
            if family == .systemSmall {
                VStack(alignment: .leading, spacing: 3) {
                    Text("점심")
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(WidgetDesign.mealAccent.opacity(0.12))
                        .cornerRadius(4)
                        .foregroundColor(WidgetDesign.mealAccent)

                    Text(entry.lunch)
                        .font(.system(size: 10.5, weight: .medium, design: .rounded))
                        .foregroundColor(WidgetDesign.bodyText)
                        .lineSpacing(2)
                        .minimumScaleFactor(0.8)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    // 점심 영역
                    VStack(alignment: .leading, spacing: 2) {
                        Text("점심")
                            .font(.system(size: 10.5, weight: .bold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(WidgetDesign.mealAccent.opacity(0.12))
                            .cornerRadius(4)
                            .foregroundColor(WidgetDesign.mealAccent)

                        Text(entry.lunch)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(WidgetDesign.bodyText)
                            .lineSpacing(1.5)
                            .minimumScaleFactor(0.85)
                    }

                    // 저녁 영역
                    VStack(alignment: .leading, spacing: 2) {
                        Text("저녁")
                            .font(.system(size: 10.5, weight: .bold))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.yellow.opacity(0.2))
                            .cornerRadius(4)
                            .foregroundColor(WidgetDesign.dinnerAccent)

                        Text(entry.dinner)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(WidgetDesign.bodyText)
                            .lineSpacing(1.5)
                            .minimumScaleFactor(0.85)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .widgetURL(URL(string: "schoolapp://meal"))
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
        .description("오늘의 점심 및 저녁 메뉴를 바로 확인합니다.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}


// MARK: - 2. 시간표 위젯 (TimetableWidget - 큰 위젯 전용)

struct TimetableCellData: Codable {
    let subject: String
    let room: String
}

struct TimetableEntry: TimelineEntry {
    let date: Date
    let headerTitle: String
    let timetableInfo: String
    let timetableMap: [String: TimetableCellData]
}

struct TimetableProvider: TimelineProvider {
    func placeholder(in context: Context) -> TimetableEntry {
        TimetableEntry(date: Date(), headerTitle: "나의 시간표", timetableInfo: "시간표 로딩 중...", timetableMap: [:])
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
        let headerTitle = defaults?.string(forKey: "gradeClass") ?? "나의 시간표"
        
        var timetableInfo = defaults?.string(forKey: "timetableList")
        if timetableInfo == nil || timetableInfo?.isEmpty == true {
            timetableInfo = defaults?.string(forKey: "timetable") ?? defaults?.string(forKey: "timeTable")
        }
        let finalInfo = timetableInfo?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "시간표 정보가 없습니다."
        
        var map: [String: TimetableCellData] = [:]
        if let jsonString = defaults?.string(forKey: "timetableData"),
           let jsonData = jsonString.data(using: .utf8) {
            map = (try? JSONDecoder().decode([String: TimetableCellData].self, from: jsonData)) ?? [:]
        }
        
        return TimetableEntry(date: Date(), headerTitle: headerTitle, timetableInfo: finalInfo, timetableMap: map)
    }
}

struct TimetableWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    var entry: TimetableEntry

    let days = ["월", "화", "수", "목", "금"]
    let periods = [1, 2, 3, 4, 5, 6, 7]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // 헤더
            HStack(spacing: 4) {
                Image(systemName: "calendar.badge.clock")
                    .foregroundColor(WidgetDesign.timetableAccent)
                    .font(.system(size: 15))
                
                Text(entry.headerTitle)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(WidgetDesign.timetableAccent)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.timetableAccent.opacity(0.2))

            // 5x7 과목 그리드
            VStack(spacing: 4) {
                // 요일 헤더
                HStack(spacing: 4) {
                    Text("")
                        .frame(width: 18)
                    ForEach(days, id: \.self) { day in
                        Text(day)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(WidgetDesign.subText)
                            .frame(maxWidth: .infinity)
                    }
                }

                // 1~7교시 행
                ForEach(periods, id: \.self) { period in
                    HStack(spacing: 4) {
                        Text("\(period)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(WidgetDesign.subText)
                            .frame(width: 18)

                        ForEach(days, id: \.self) { day in
                            let key = "\(day)-\(period)"
                            let subject = entry.timetableMap[key]?.subject.trimmingCharacters(in: .whitespaces) ?? ""
                            let hasData = !subject.isEmpty

                            ZStack {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(hasData ? Color(UIColor.secondarySystemBackground) : Color(UIColor.tertiarySystemBackground).opacity(0.3))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 6)
                                            .stroke(hasData ? WidgetDesign.timetableAccent.opacity(0.5) : Color.clear, lineWidth: 1)
                                    )

                                Text(hasData ? subject : "")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(hasData ? WidgetDesign.timetableAccent : WidgetDesign.bodyText)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .minimumScaleFactor(0.7)
                                    .padding(.horizontal, 2)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(10)
        .widgetURL(URL(string: "schoolapp://timetable"))
        .containerBackground(for: .widget) { WidgetDesign.backgroundColor }
    }
}

struct TimetableWidget: Widget {
    let kind: String = "TimetableWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TimetableProvider()) { entry in
            TimetableWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("시간표 그리드")
        .description("전체 주간 시간표를 한눈에 확인합니다.")
        // 🎯 소형/중형을 없애고 가장 큰 위젯만 남겼습니다.
        .supportedFamilies([.systemLarge, .systemExtraLarge])
    }
}
