class HomeController < ApplicationController
    def index
        # image size 530 600
        # 어디까지 했꼬 남은게 뭔지 - 점수 체크
        @pine_art = ["gogh", "mona", "pica", "scream"]
        @rand = @pine_art.sample
        @img_name = @rand + ".jpg"
    end
end
