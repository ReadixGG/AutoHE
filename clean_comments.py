#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для удаления комментариев из файлов проекта AutoHE
Обрабатывает HTML, CSS, JavaScript файлы
Учитывает строки, обратные кавычки, регулярные выражения
"""

import os
import re
import sys
from pathlib import Path

def remove_html_comments(content):
    """Удаляет HTML комментарии <!-- -->"""
    # Удаляем HTML комментарии, но оставляем условные комментарии IE
    pattern = r'<!--(?!\[if).*?-->'
    return re.sub(pattern, '', content, flags=re.DOTALL)

def remove_css_comments(content):
    """Удаляет CSS комментарии /* */"""
    result = []
    i = 0
    in_string = False
    string_char = None
    
    while i < len(content):
        char = content[i]
        
        # Обработка строк
        if not in_string and char in ['"', "'"]:
            in_string = True
            string_char = char
            result.append(char)
        elif in_string and char == string_char:
            # Проверяем, не экранирован ли символ
            escaped = False
            j = i - 1
            while j >= 0 and content[j] == '\\':
                escaped = not escaped
                j -= 1
            if not escaped:
                in_string = False
                string_char = None
            result.append(char)
        elif in_string:
            result.append(char)
        # Обработка комментариев
        elif not in_string and i < len(content) - 1 and content[i:i+2] == '/*':
            # Ищем конец комментария
            end = content.find('*/', i + 2)
            if end != -1:
                i = end + 1  # Пропускаем весь комментарий
            else:
                i = len(content)  # Если нет закрывающего тега, идём до конца
            continue
        else:
            result.append(char)
        
        i += 1
    
    return ''.join(result)

def remove_js_comments(content):
    """Удаляет JavaScript комментарии // и /* */"""
    result = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines):
        cleaned_line = remove_js_comments_from_line(line)
        result.append(cleaned_line)
    
    # Удаляем блочные комментарии /* */
    content = '\n'.join(result)
    return remove_css_comments(content)  # CSS и JS используют одинаковые блочные комментарии

def remove_js_comments_from_line(line):
    """Удаляет однострочные комментарии // из строки"""
    result = []
    i = 0
    in_string = False
    string_char = None
    in_regex = False
    
    while i < len(line):
        char = line[i]
        
        # Обработка строк
        if not in_string and not in_regex and char in ['"', "'", '`']:
            in_string = True
            string_char = char
            result.append(char)
        elif in_string and char == string_char:
            # Проверяем экранирование
            escaped = False
            j = i - 1
            while j >= 0 and line[j] == '\\':
                escaped = not escaped
                j -= 1
            if not escaped:
                in_string = False
                string_char = None
            result.append(char)
        elif in_string:
            result.append(char)
        # Обработка регулярных выражений
        elif not in_string and not in_regex and char == '/' and i > 0:
            # Проверяем, может ли это быть началом regex
            prev_chars = line[:i].strip()
            if (prev_chars.endswith(('=', '(', '[', ',', ':', ';', '!', '&', '|', '?', '+', '-', '*', '/', '%', '{', '}', 'return')) or
                prev_chars == '' or re.search(r'[=(!&|?+\-*/%{},:]$', prev_chars)):
                in_regex = True
            result.append(char)
        elif in_regex and char == '/':
            # Проверяем экранирование
            escaped = False
            j = i - 1
            while j >= 0 and line[j] == '\\':
                escaped = not escaped
                j -= 1
            if not escaped:
                in_regex = False
            result.append(char)
        elif in_regex:
            result.append(char)
        # Обработка комментариев
        elif not in_string and not in_regex and i < len(line) - 1 and line[i:i+2] == '//':
            # Найден комментарий, обрезаем строку
            break
        else:
            result.append(char)
        
        i += 1
    
    return ''.join(result).rstrip()

def clean_file(file_path):
    """Обрабатывает один файл"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_size = len(content)
        
        # Определяем тип файла и применяем соответствующую очистку
        if file_path.suffix.lower() == '.html':
            content = remove_html_comments(content)
        elif file_path.suffix.lower() == '.css':
            content = remove_css_comments(content)
        elif file_path.suffix.lower() == '.js':
            content = remove_js_comments(content)
        else:
            print(f"⚠️  Неизвестный тип файла: {file_path}")
            return False
        
        # Убираем лишние пустые строки (более 2 подряд)
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # Убираем пробелы в конце строк
        content = '\n'.join(line.rstrip() for line in content.split('\n'))
        
        new_size = len(content)
        
        # Записываем обратно только если есть изменения
        if original_size != new_size:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            saved_bytes = original_size - new_size
            print(f"✅ {file_path.name}: -{saved_bytes} байт ({saved_bytes/original_size*100:.1f}%)")
            return True
        else:
            print(f"➖ {file_path.name}: без изменений")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка при обработке {file_path}: {e}")
        return False

def main():
    """Основная функция"""
    print("🧹 Очистка комментариев в проекте AutoHE")
    print("=" * 50)
    
    # Получаем путь к проекту
    project_dir = Path(__file__).parent
    
    # Файлы для обработки
    file_patterns = [
        '*.html',
        '*.css', 
        '*.js'
    ]
    
    # Исключения
    exclude_files = {
        '.htaccess',
        'clean_comments.py',
        'node_modules',
        '.git'
    }
    
    total_files = 0
    processed_files = 0
    
    for pattern in file_patterns:
        for file_path in project_dir.rglob(pattern):
            # Пропускаем исключения
            if any(exc in str(file_path) for exc in exclude_files):
                continue
                
            total_files += 1
            if clean_file(file_path):
                processed_files += 1
    
    print("=" * 50)
    print(f"📊 Обработано: {processed_files}/{total_files} файлов")
    
    if processed_files > 0:
        print("✨ Очистка завершена успешно!")
    else:
        print("ℹ️  Файлы уже очищены или комментарии не найдены")

if __name__ == '__main__':
    main() 