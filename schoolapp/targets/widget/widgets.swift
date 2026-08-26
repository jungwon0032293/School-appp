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
            mealType: "8월 26일",
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
        let rawMealType = defaults?.string(forKey: "mealType") ?? "오늘"
        
        // "급식" 글자를 지우고 날짜만 표시 (예: "8월 26일 급식" -> "8월 26일")
        let formattedMealType = rawMealType.replacingOccurrences(of: " 급식", with: "")
                                           .replacingOccurrences(of: "급식", with: "")
                                           .trimmingCharacters(in: .whitespaces)
        
        let lunch = defaults?.string(forKey: "mealLunch") ?? "급식 정보가 없습니다."
        let dinner = defaults?.string(forKey: "mealDinner") ?? "저녁 급식 정보가 없습니다."
        
        return MealEntry(date: Date(), mealType: formattedMealType.isEmpty ? "오늘" : formattedMealType, lunch: lunch, dinner: dinner)
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
        VStack(alignment: .leading, spacing: 4) {
            // 헤더 영역 (크기 줄임)
            HStack(spacing: 3) {
                Image(systemName: "fork.knife.circle.fill")
                    .foregroundColor(WidgetDesign.mealAccent)
                    .font(.system(size: family == .systemSmall ? 11 : 12))
                
                Text(entry.mealType)
                    .font(.system(size: family == .systemSmall ? 11 : 12, weight: .bold))
                    .foregroundColor(WidgetDesign.mealAccent)
                    .lineLimit(1)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.mealAccent.opacity(0.15))
                .padding(.bottom, 1)

            // 본문 영역 (가독성 향상 및 텍스트 전체 표시)
            if family == .systemSmall {
                VStack(alignment: .leading, spacing: 2) {
                    Text("점심")
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(WidgetDesign.mealAccent.opacity(0.12))
                        .cornerRadius(3)
                        .foregroundColor(WidgetDesign.mealAccent)

                    Text(entry.lunch)
                        .font(.system(size: 9.5, weight: .medium, design: .rounded))
                        .foregroundColor(WidgetDesign.bodyText)
                        .lineSpacing(1)
                        .minimumScaleFactor(0.65)
                        .fixedSize(horizontal: false, vertical: false)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    // 점심 영역
                    VStack(alignment: .leading, spacing: 2) {
                        Text("점심")
                            .font(.system(size: 9.5, weight: .bold))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(WidgetDesign.mealAccent.opacity(0.12))
                            .cornerRadius(3)
                            .foregroundColor(WidgetDesign.mealAccent)

                        Text(entry.lunch)
                            .font(.system(size: 10.5, weight: .medium, design: .rounded))
                            .foregroundColor(WidgetDesign.bodyText)
                            .lineSpacing(1)
                            .minimumScaleFactor(0.7)
                            .fixedSize(horizontal: false, vertical: false)
                    }

                    // 저녁 영역
                    VStack(alignment: .leading, spacing: 2) {
                        Text("저녁")
                            .font(.system(size: 9.5, weight: .bold))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.yellow.opacity(0.2))
                            .cornerRadius(3)
                            .foregroundColor(WidgetDesign.dinnerAccent)

                        Text(entry.dinner)
                            .font(.system(size: 10.5, weight: .medium, design: .rounded))
                            .foregroundColor(WidgetDesign.bodyText)
                            .lineSpacing(1)
                            .minimumScaleFactor(0.7)
                            .fixedSize(horizontal: false, vertical: false)
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(8)
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
        VStack(alignment: .leading, spacing: 4) {
            // 헤더 영역 (크기 줄임)
            HStack(spacing: 3) {
                Image(systemName: "calendar.badge.clock")
                    .foregroundColor(WidgetDesign.timetableAccent)
                    .font(.system(size: 12))
                
                Text(entry.headerTitle)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(WidgetDesign.timetableAccent)
                
                Spacer()
            }
            
            Divider()
                .background(WidgetDesign.timetableAccent.opacity(0.15))
                .padding(.bottom, 1)

            // 5x7 과목 그리드
            VStack(spacing: 3) {
                // 요일 헤더
                HStack(spacing: 3) {
                    Text("")
                        .frame(width: 16)
                    ForEach(days, id: \.self) { day in
                        Text(day)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(WidgetDesign.subText)
                            .frame(maxWidth: .infinity)
                    }
                }

                // 1~7교시 행
                ForEach(periods, id: \.self) { period in
                    HStack(spacing: 3) {
                        Text("\(period)")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundColor(WidgetDesign.subText)
                            .frame(width: 16)

                        ForEach(days, id: \.self) { day in
                            let key = "\(day)-\(period)"
                            let subject = entry.timetableMap[key]?.subject.trimmingCharacters(in: .whitespaces) ?? ""
                            let hasData = !subject.isEmpty

                            ZStack {
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(hasData ? Color(UIColor.secondarySystemBackground) : Color(UIColor.tertiarySystemBackground).opacity(0.3))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 5)
                                            .stroke(hasData ? WidgetDesign.timetableAccent.opacity(0.5) : Color.clear, lineWidth: 0.8)
                                    )

                                Text(hasData ? subject : "")
                                    .font(.system(size: 9.5, weight: .bold))
                                    .foregroundColor(hasData ? WidgetDesign.timetableAccent : WidgetDesign.bodyText)
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                                    .minimumScaleFactor(0.65)
                                    .padding(.horizontal, 1)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(8)
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
        .supportedFamilies([.systemLarge, .systemExtraLarge])
    }
}
