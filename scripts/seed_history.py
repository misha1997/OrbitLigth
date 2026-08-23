import os
import sys

# Add parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa
from database import get_db_connection

EVENTS = [
    (1, 1, 1801, "Giuseppe Piazzi discovers the first asteroid, Ceres.", "Джузеппе Піацці відкриває перший астероїд — Цереру."),
    (1, 4, 1959, "Luna 1 becomes the first spacecraft to reach the vicinity of the Moon.", "«Луна-1» стає першим космічним апаратом, що досяг околиць Місяця."),
    (1, 14, 2005, "Huygens probe lands on Saturn's moon Titan.", "Зонд «Гюйгенс» здійснює посадку на супутник Сатурна Титан."),
    (1, 28, 1986, "Space Shuttle Challenger disaster.", "Катастрофа космічного шатла «Челленджер»."),
    (1, 31, 1958, "Explorer 1, the first U.S. satellite, is launched.", "Запущено «Експлорер-1», перший супутник США."),
    (2, 1, 2003, "Space Shuttle Columbia disaster during reentry.", "Катастрофа космічного шатла «Колумбія» під час повернення в атмосферу."),
    (2, 11, 2016, "LIGO collaboration announces the first direct detection of gravitational waves.", "Колаборація LIGO оголошує про перше пряме виявлення гравітаційних хвиль."),
    (2, 14, 1990, "Voyager 1 takes the 'Pale Blue Dot' photograph of Earth.", "«Вояджер-1» робить знімок Землі «Бліда блакитна цятка»."),
    (2, 18, 2021, "Perseverance rover lands on Mars.", "Марсохід Perseverance здійснює посадку на Марс."),
    (2, 20, 1986, "Core module of the Mir space station is launched.", "Запуск базового блоку орбітальної станції «Мир»."),
    (3, 13, 1781, "William Herschel discovers Uranus.", "Вільям Гершель відкриває планету Уран."),
    (3, 14, 2016, "ExoMars Trace Gas Orbiter is launched to Mars.", "Запуск апарата ExoMars Trace Gas Orbiter до Марса."),
    (3, 16, 1926, "Robert Goddard launches the first liquid-fueled rocket.", "Роберт Годдард запускає першу ракету на рідкому паливі."),
    (3, 18, 1965, "Alexey Leonov performs the first spacewalk.", "Олексій Леонов здійснює перший вихід у відкритий космос."),
    (4, 12, 1961, "Yuri Gagarin becomes the first human in space.", "Юрій Гагарін стає першою людиною у космосі."),
    (4, 12, 1981, "The first Space Shuttle mission (STS-1) launches.", "Запуск першої місії космічного шатла (STS-1)."),
    (4, 24, 1990, "Hubble Space Telescope is launched.", "Запуск космічного телескопа «Габбл»."),
    (5, 5, 1961, "Alan Shepard becomes the first American in space.", "Алан Шепард стає першим американцем у космосі."),
    (5, 14, 1973, "Skylab, the first US space station, is launched.", "Запуск «Скайлеб», першої орбітальної станції США."),
    (6, 3, 1965, "Ed White performs the first American spacewalk.", "Ед Вайт здійснює перший вихід у космос серед американців."),
    (6, 16, 1963, "Valentina Tereshkova becomes the first woman in space.", "Валентина Терешкова стає першою жінкою в космосі."),
    (7, 4, 1997, "Mars Pathfinder lands on Mars.", "Апарат Mars Pathfinder здійснює посадку на Марсі."),
    (7, 14, 2015, "New Horizons probe makes its closest approach to Pluto.", "Зонд New Horizons максимально наближається до Плутона."),
    (7, 16, 1969, "Apollo 11 mission launches toward the Moon.", "Старт місії Аполлон-11 до Місяця."),
    (7, 20, 1969, "Apollo 11 mission: humans walk on the Moon for the first time.", "Місія Аполлон-11: люди вперше ступили на поверхню Місяця."),
    (7, 23, 1999, "Chandra X-ray Observatory is launched.", "Запуск рентгенівської обсерваторії «Чандра»."),
    (8, 6, 2012, "Curiosity rover lands on Mars.", "Марсохід Curiosity здійснює посадку на Марс."),
    (8, 23, 1966, "Lunar Orbiter 1 takes the first photograph of Earth from the Moon.", "Lunar Orbiter 1 робить першу фотографію Землі з орбіти Місяця."),
    (8, 24, 2006, "Pluto is reclassified as a dwarf planet.", "Плутон позбавлено статусу планети і переведено до карликових."),
    (8, 25, 2012, "Voyager 1 becomes the first human-made object to enter interstellar space.", "«Вояджер-1» стає першим штучним об'єктом, який увійшов у міжзоряний простір."),
    (9, 5, 1977, "Voyager 1 probe is launched.", "Запуск космічного зонда «Вояджер-1»."),
    (9, 23, 1846, "Neptune is discovered by Johann Galle.", "Йоганн Галле відкриває планету Нептун."),
    (10, 4, 1957, "Sputnik 1, the first artificial Earth satellite, is launched.", "Запуск «Супутника-1» — першого штучного супутника Землі."),
    (10, 15, 1997, "Cassini-Huygens mission to Saturn is launched.", "Запуск місії Кассіні-Гюйгенс до Сатурна."),
    (10, 31, 2000, "Expedition 1 launches to the ISS, beginning continuous human presence in space.", "Запуск Експедиції-1 до МКС, початок безперервної присутності людей у космосі."),
    (11, 3, 1957, "Sputnik 2 is launched with Laika the dog.", "Запуск «Супутника-2» із собакою Лайкою на борту."),
    (11, 20, 1998, "Zarya, the first module of the ISS, is launched.", "Запуск «Зорі» — першого модуля Міжнародної космічної станції."),
    (11, 26, 2011, "Mars Science Laboratory (Curiosity) is launched.", "Запуск марсохода Curiosity."),
    (12, 14, 1962, "Mariner 2 becomes the first spacecraft to successfully fly by Venus.", "«Марінер-2» стає першим апаратом, що успішно пролетів повз Венеру."),
    (12, 21, 1968, "Apollo 8 becomes the first crewed spacecraft to orbit the Moon.", "«Аполлон-8» стає першим пілотованим апаратом на орбіті Місяця."),
    (12, 25, 2021, "James Webb Space Telescope is launched.", "Запуск космічного телескопа імені Джеймса Вебба.")
]

def seed_history():
    conn = get_db_connection()
    cur = conn.cursor()
    
    print("Creating table space_history...")
    cur.execute('''
        CREATE TABLE IF NOT EXISTS space_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month INT NOT NULL,
            day INT NOT NULL,
            year INT,
            text_en TEXT NOT NULL,
            text_uk TEXT NOT NULL,
            INDEX idx_month_day (month, day)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ''')
    
    print("Clearing old events...")
    cur.execute("TRUNCATE TABLE space_history")
    
    print(f"Inserting {len(EVENTS)} events...")
    sql = "INSERT INTO space_history (month, day, year, text_en, text_uk) VALUES (%s, %s, %s, %s, %s)"
    cur.executemany(sql, EVENTS)
    
    conn.commit()
    cur.close()
    conn.close()
    print("Done!")

if __name__ == "__main__":
    seed_history()
