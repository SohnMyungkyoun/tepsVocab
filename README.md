# Vocab Focus

`vocab.md`에 단어를 단락별로 적어 두면, 같은 단락의 단어를 한 묶음으로 학습하는 모바일 우선 웹앱입니다.

## 단어 형식

각 줄은 다음처럼 작성합니다. 빈 줄이 단락을 구분하며, 새로 추가하는 단어는 뜻 없이 적어도 됩니다.

```md
word — 뜻 하나, 뜻 둘
another word — 뜻

new word
```

학습 중 ‘완벽히 알아요’를 선택하면 해당 단어는 기기에 저장되어 다음 학습부터 나오지 않습니다. GitHub 동기화를 설정했다면 줄 끝에 `<!-- known -->` 태그도 자동으로 기록됩니다.

## GitHub Pages 배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy-pages.yml`이 사이트를 GitHub Pages에 배포합니다. 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 한 번 설정하세요.

## 여러 기기에서 완료 상태 동기화

사이트 우측 상단 설정에서 `owner/repository`와 Fine-grained Personal Access Token을 입력합니다. 토큰은 해당 저장소의 **Contents: Read and write** 권한만 부여하고, 이 기기의 브라우저에만 저장됩니다. 완료 체크 때마다 `vocab.md`의 태그가 GitHub에 커밋됩니다.
