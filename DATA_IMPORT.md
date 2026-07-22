# 数据导入指南

## 学员数据导入

### 1. 准备学员名单

在Excel中准备学员名单，包含以下列：
- 工号
- 姓名
- 类型（服务/非服务）

示例：

| 工号 | 姓名 | 类型 |
|------|------|------|
| S001 | 张三 | 服务 |
| S002 | 李四 | 服务 |
| N001 | 王五 | 非服务 |

### 2. 转换为JSON格式

将Excel数据转换为JSON格式：

```json
{
  "S001": {"id": "S001", "name": "张三", "type": "服务"},
  "S002": {"id": "S002", "name": "李四", "type": "服务"},
  "N001": {"id": "N001", "name": "王五", "type": "非服务"}
}
```

### 3. 保存到文件

将JSON数据保存到 `server/data/students.json` 文件。

## 门店数据配置

### 1. 服务类门店

编辑 `server/data/stores.json` 文件中的 `service` 数组：

```json
{
  "service": [
    {"name": "小米之家北京朝阳区三里屯太古里店", "capacity": 3, "type": "服务"},
    {"name": "小米之家北京朝阳区大悦城店", "capacity": 3, "type": "服务"},
    {"name": "小米之家北京海淀区西三旗万象汇专卖店", "capacity": 2, "type": "服务"}
  ]
}
```

### 2. 非服务类门店

编辑 `server/data/stores.json` 文件中的 `nonService` 数组：

```json
{
  "nonService": [
    {"name": "小米之家北京海淀区西三旗万象汇专卖店", "capacity": 2, "type": "非服务"},
    {"name": "小米之家北京海淀西北旺万象汇专卖店", "capacity": 2, "type": "非服务"}
  ]
}
```

## 数据验证

### 1. 验证学员数据

启动系统后，在学员端输入工号和姓名，系统会自动验证：
- 工号是否存在
- 姓名是否匹配

### 2. 验证门店数据

在管理员端查看门店概览，确认：
- 门店数量正确
- 容量设置正确
- 类型分类正确

## 批量导入工具（可选）

如果需要批量导入大量数据，可以使用以下Python脚本：

```python
import json
import pandas as pd

# 读取Excel文件
df = pd.read_excel('学员名单.xlsx')

# 转换为JSON格式
students = {}
for _, row in df.iterrows():
    student_id = str(row['工号'])
    students[student_id] = {
        'id': student_id,
        'name': row['姓名'],
        'type': row['类型']
    }

# 保存到JSON文件
with open('server/data/students.json', 'w', encoding='utf-8') as f:
    json.dump(students, f, ensure_ascii=False, indent=2)

print(f'成功导入 {len(students)} 条学员数据')
```

## 注意事项

1. **工号唯一性**：确保每个学员的工号是唯一的
2. **类型匹配**：学员类型必须是"服务"或"非服务"
3. **编码格式**：JSON文件必须使用UTF-8编码
4. **备份数据**：修改数据前建议备份原文件

## 常见问题

### Q: 如何修改已分配的学员？

A: 编辑 `server/data/allocations.json` 文件，删除对应记录。

### Q: 如何添加新门店？

A: 编辑 `server/data/stores.json` 文件，在对应类型数组中添加新门店。

### Q: 如何修改门店容量？

A: 编辑 `server/data/stores.json` 文件，修改对应门店的 `capacity` 字段。

### Q: 数据文件在哪里？

A: 所有数据文件都在 `server/data/` 目录下：
- `stores.json` - 门店数据
- `students.json` - 学员数据
- `allocations.json` - 分配结果
