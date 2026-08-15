# 糖泡对战

一个浏览器版 2D 糖泡炸弹人游戏，玩法参考泡泡堂、QQ堂和炸弹人。

## 功能

- Phaser 3 浏览器游戏
- 单人模式：玩家 vs AI
- 本地双人：同一键盘 1v1
- 糖泡放置、十字爆炸、软糖块破坏、连锁爆炸
- 属性道具：威力药水、飞鞋、糖泡数量
- 战术道具：飞镖、香蕉皮、针、盾牌
- 4 格背包，道具按拾取顺序进入 `1-4`，使用后自动前移
- 泡泡堂式困住机制：被爆炸击中后先困住，超时出局

## 运行

```bash
npm run serve
```

然后打开：

```text
http://localhost:8000/
```

## 测试

```bash
npm test
```

## 操作

玩家1：

- 移动：`WASD`
- 放糖泡：`Space`
- 使用背包道具：`1-4`

玩家2：

- 移动：方向键
- 放糖泡：`Enter`
- 使用背包道具：小键盘 `1-4`

## 项目结构

```text
.
├── index.html
├── package.json
├── src/
│   ├── assets/
│   ├── core/gameRules.js
│   ├── main.js
│   └── styles.css
└── test/gameRules.test.js
```

## 说明

游戏素材为原创生成的卡通风格 PNG 资产，核心玩法规则集中在 `src/core/gameRules.js`，并通过 Node 内置测试覆盖。
